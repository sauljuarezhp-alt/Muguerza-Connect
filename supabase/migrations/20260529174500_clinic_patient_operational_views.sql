-- Read-only patient views for the ambulatory clinic module.
-- These views keep clinic patient UI reads scoped to clinic tables and RLS.

create or replace view public.clinic_patient_operational_summary
with (security_invoker = true)
as
select
  cp.id,
  cp.clinic_id,
  cp.full_name,
  cp.phone,
  cp.email,
  cp.sex,
  cp.date_of_birth,
  cp.external_patient_ref,
  cp.insurer,
  cp.policy_number,
  cp.emergency_contact,
  cp.notes,
  cp.active,
  cp.created_at,
  cp.updated_at,
  coalesce(a.visits_total, 0)::int as visits_total,
  coalesce(a.completed_visits, 0)::int as completed_visits,
  coalesce(a.cancelled_or_no_show_count, 0)::int as cancelled_or_no_show_count,
  (coalesce(a.visits_total, 0) > 1 or coalesce(a.completed_visits, 0) > 1) as is_recurrent,
  a.last_visit_at,
  a.next_visit_at,
  a.current_appointment_id,
  a.current_service_name,
  a.current_service_type,
  coalesce(pa.pending_preauth_count, 0)::int as pending_preauth_count,
  coalesce(sr.critical_results_count, 0)::int as critical_results_count,
  coalesce(cc.open_conversation_count, 0)::int as open_conversation_count,
  coalesce(cra.active_assignment_count, 0)::int as active_assignment_count,
  case
    when coalesce(a.has_escalated, false) then 'escalated'
    when coalesce(a.has_in_progress, false) then 'in_progress'
    when coalesce(a.has_checked_in, false) then 'checked_in'
    when coalesce(sr.critical_unnotified_count, 0) > 0 then 'follow_up_required'
    when coalesce(pa.pending_preauth_count, 0) > 0 then 'follow_up_required'
    when a.next_visit_at is not null then 'scheduled'
    when coalesce(a.completed_visits, 0) > 0 then 'completed'
    when coalesce(a.cancelled_or_no_show_count, 0) > 0 then 'cancelled'
    else 'no_activity'
  end as current_status
from public.clinic_patients cp
left join lateral (
  select
    count(*) as visits_total,
    count(*) filter (where sa.status = 'completed') as completed_visits,
    count(*) filter (where sa.status in ('cancelled', 'no_show')) as cancelled_or_no_show_count,
    max(sa.scheduled_at) filter (where sa.scheduled_at <= now()) as last_visit_at,
    min(sa.scheduled_at) filter (where sa.scheduled_at >= now() and sa.status = 'scheduled') as next_visit_at,
    bool_or(sa.status = 'escalated') as has_escalated,
    bool_or(sa.status = 'in_progress') as has_in_progress,
    bool_or(sa.status = 'checked_in') as has_checked_in,
    (array_agg(sa.id order by case when sa.status in ('checked_in', 'in_progress', 'escalated') then 0 else 1 end, sa.scheduled_at desc))[1] as current_appointment_id,
    (array_agg(cs.name order by case when sa.status in ('checked_in', 'in_progress', 'escalated') then 0 else 1 end, sa.scheduled_at desc))[1] as current_service_name,
    (array_agg(cs.service_type order by case when sa.status in ('checked_in', 'in_progress', 'escalated') then 0 else 1 end, sa.scheduled_at desc))[1] as current_service_type
  from public.service_appointments sa
  left join public.clinic_services cs on cs.id = sa.service_id
  where sa.patient_id = cp.id
    and sa.clinic_id = cp.clinic_id
) a on true
left join lateral (
  select count(*) filter (where par.status in ('pending', 'in_review')) as pending_preauth_count
  from public.pre_auth_requests par
  where par.patient_id = cp.id
    and par.clinic_id = cp.clinic_id
) pa on true
left join lateral (
  select
    count(*) filter (where sr.critical) as critical_results_count,
    count(*) filter (where sr.critical and sr.notified_at is null) as critical_unnotified_count
  from public.service_results sr
  where sr.patient_id = cp.id
    and sr.clinic_id = cp.clinic_id
) sr on true
left join lateral (
  select count(*) filter (where cc.status in ('bot', 'waiting_human', 'in_progress', 'escalated')) as open_conversation_count
  from public.clinic_conversations cc
  where cc.patient_id = cp.id
    and cc.clinic_id = cp.clinic_id
) cc on true
left join lateral (
  select count(*) filter (where cra.status = 'active') as active_assignment_count
  from public.clinic_resource_assignments cra
  where cra.patient_id = cp.id
    and cra.clinic_id = cp.clinic_id
) cra on true;

create or replace view public.clinic_patient_timeline
with (security_invoker = true)
as
select
  ('appointment-' || sa.id::text) as id,
  sa.clinic_id,
  sa.patient_id,
  'appointment'::text as event_type,
  sa.scheduled_at as occurred_at,
  coalesce(cs.name, 'Servicio ambulatorio')::text as title,
  (sa.status || case when sa.pre_auth_status is not null then ' - preauth ' || sa.pre_auth_status else '' end)::text as description,
  case
    when sa.status = 'escalated' then 'critical'
    when sa.status in ('cancelled', 'no_show') then 'warning'
    when sa.status = 'completed' then 'success'
    when sa.status in ('checked_in', 'in_progress') then 'info'
    else 'neutral'
  end::text as severity,
  'service_appointments'::text as source_table,
  sa.id::text as source_id,
  jsonb_build_object('status', sa.status, 'service_id', sa.service_id, 'service_name', cs.name, 'service_type', cs.service_type, 'pre_auth_status', sa.pre_auth_status, 'insurer', sa.insurer) as metadata
from public.service_appointments sa
left join public.clinic_services cs on cs.id = sa.service_id

union all

select
  ('preauth-' || par.id::text) as id,
  par.clinic_id,
  par.patient_id,
  'preauth'::text as event_type,
  coalesce(par.resolved_at, par.submitted_at, par.created_at) as occurred_at,
  ('Pre-autorizacion ' || par.status)::text as title,
  concat_ws(' - ', par.insurer, par.folio_aseguradora)::text as description,
  case
    when par.status in ('rejected', 'expired') then 'critical'
    when par.status in ('pending', 'in_review') then 'warning'
    when par.status = 'approved' then 'success'
    else 'neutral'
  end::text as severity,
  'pre_auth_requests'::text as source_table,
  par.id::text as source_id,
  jsonb_build_object('status', par.status, 'insurer', par.insurer, 'folio_aseguradora', par.folio_aseguradora, 'service_appointment_id', par.service_appointment_id) as metadata
from public.pre_auth_requests par

union all

select
  ('result-' || sr.id::text) as id,
  sr.clinic_id,
  sr.patient_id,
  'result'::text as event_type,
  sr.created_at as occurred_at,
  case sr.result_type when 'lab' then 'Resultado de laboratorio' when 'imaging' then 'Resultado de imagen' else 'Nota de procedimiento' end::text as title,
  case when sr.critical then 'Resultado critico' else sr.notes end::text as description,
  case when sr.critical then 'critical' else 'info' end::text as severity,
  'service_results'::text as source_table,
  sr.id::text as source_id,
  jsonb_build_object('result_type', sr.result_type, 'critical', sr.critical, 'notified_at', sr.notified_at, 'bucket', sr.bucket, 'storage_path', sr.storage_path) as metadata
from public.service_results sr

union all

select
  ('conversation-' || cc.id::text) as id,
  cc.clinic_id,
  cc.patient_id,
  'conversation'::text as event_type,
  cc.last_message_at as occurred_at,
  ('Conversacion ' || cc.status)::text as title,
  cc.last_message_preview::text as description,
  case when cc.status = 'escalated' then 'critical' when cc.status = 'waiting_human' then 'warning' else 'neutral' end::text as severity,
  'clinic_conversations'::text as source_table,
  cc.id::text as source_id,
  jsonb_build_object('status', cc.status, 'intent', cc.intent, 'channel', cc.channel, 'related_appointment_id', cc.related_appointment_id, 'unread_count', cc.unread_count) as metadata
from public.clinic_conversations cc

union all

select
  ('assignment-' || cra.id::text) as id,
  cra.clinic_id,
  cra.patient_id,
  'resource'::text as event_type,
  coalesce(cra.ended_at, cra.started_at) as occurred_at,
  case when cra.status = 'active' then 'Recurso asignado' else 'Recurso liberado' end::text as title,
  concat_ws(' - ', cr.short_code, cr.name)::text as description,
  case when cra.status = 'active' then 'info' else 'neutral' end::text as severity,
  'clinic_resource_assignments'::text as source_table,
  cra.id::text as source_id,
  jsonb_build_object('status', cra.status, 'resource_id', cra.resource_id, 'resource_name', cr.name, 'resource_short_code', cr.short_code, 'appointment_id', cra.appointment_id, 'manual', cra.manual) as metadata
from public.clinic_resource_assignments cra
left join public.clinic_resources cr on cr.id = cra.resource_id

union all

select
  ('audit-' || cal.id::text) as id,
  cal.clinic_id,
  cal.patient_id,
  'audit'::text as event_type,
  cal.created_at as occurred_at,
  cal.action::text as title,
  cal.entity_table::text as description,
  'neutral'::text as severity,
  'clinic_audit_log'::text as source_table,
  cal.id::text as source_id,
  jsonb_build_object('action', cal.action, 'entity_table', cal.entity_table, 'entity_id', cal.entity_id, 'metadata', cal.metadata) as metadata
from public.clinic_audit_log cal
where cal.patient_id is not null;

revoke all on table public.clinic_patient_operational_summary from anon;
revoke all on table public.clinic_patient_timeline from anon;
grant select on table public.clinic_patient_operational_summary to authenticated;
grant select on table public.clinic_patient_timeline to authenticated;
