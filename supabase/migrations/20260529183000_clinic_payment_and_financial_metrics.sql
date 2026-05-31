-- Payment model and financial metrics for ambulatory clinic appointments.
-- This supports future WhatsApp booking while keeping the operational source
-- of truth in service_appointments and audited RPCs.

alter table public.clinic_services
  add column if not exists list_price numeric(12,2) not null default 0,
  add column if not exists insurer_price numeric(12,2) null,
  add column if not exists cost_basis numeric(12,2) null,
  add column if not exists payment_required boolean not null default true;

alter table public.service_appointments
  add column if not exists payment_model text not null default 'out_of_pocket',
  add column if not exists payment_method text not null default 'efectivo',
  add column if not exists payment_status text not null default 'pendiente',
  add column if not exists quoted_price numeric(12,2) not null default 0,
  add column if not exists patient_responsibility_amount numeric(12,2) not null default 0,
  add column if not exists insurer_expected_amount numeric(12,2) not null default 0,
  add column if not exists amount_collected numeric(12,2) not null default 0,
  add column if not exists payment_confirmed_at timestamptz null,
  add column if not exists cancellation_reason text null,
  add column if not exists cancelled_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinic_services_money_nonnegative'
  ) then
    alter table public.clinic_services
      add constraint clinic_services_money_nonnegative
      check (
        list_price >= 0
        and (insurer_price is null or insurer_price >= 0)
        and (cost_basis is null or cost_basis >= 0)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_appointments_payment_model_check'
  ) then
    alter table public.service_appointments
      add constraint service_appointments_payment_model_check
      check (payment_model in ('out_of_pocket', 'aseguradora'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_appointments_payment_method_check'
  ) then
    alter table public.service_appointments
      add constraint service_appointments_payment_method_check
      check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'aseguradora', 'cortesia', 'pendiente'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_appointments_payment_status_check'
  ) then
    alter table public.service_appointments
      add constraint service_appointments_payment_status_check
      check (payment_status in (
        'pendiente',
        'preauth_pendiente',
        'preauth_aprobada',
        'preauth_rechazada',
        'pagado',
        'cancelado',
        'cortesia',
        'reembolsado'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'service_appointments_money_nonnegative'
  ) then
    alter table public.service_appointments
      add constraint service_appointments_money_nonnegative
      check (
        quoted_price >= 0
        and patient_responsibility_amount >= 0
        and insurer_expected_amount >= 0
        and amount_collected >= 0
      );
  end if;
end;
$$;

update public.clinic_services
set
  list_price = case
    when service_type = 'infusion' and name ilike '%quimio%' then 18000
    when service_type = 'infusion' then 4500
    when service_type = 'lab' then 850
    when service_type = 'imaging' and name ilike '%ultra%' then 2200
    when service_type = 'imaging' then 1200
    when service_type = 'surgery' then 35000
    when service_type = 'consult' then 1200
    else list_price
  end,
  insurer_price = case
    when service_type = 'infusion' and name ilike '%quimio%' then 16500
    when service_type = 'infusion' then 4200
    when service_type = 'lab' then 800
    when service_type = 'imaging' and name ilike '%ultra%' then 2000
    when service_type = 'imaging' then 1100
    when service_type = 'surgery' then 33000
    when service_type = 'consult' then 1000
    else insurer_price
  end,
  cost_basis = case
    when service_type = 'infusion' and name ilike '%quimio%' then 12000
    when service_type = 'infusion' then 2600
    when service_type = 'lab' then 350
    when service_type = 'imaging' and name ilike '%ultra%' then 900
    when service_type = 'imaging' then 500
    when service_type = 'surgery' then 21000
    when service_type = 'consult' then 400
    else cost_basis
  end
where list_price = 0;

update public.service_appointments sa
set
  payment_model = case
    when sa.pre_auth_status in ('pending', 'in_review', 'approved', 'rejected') then 'aseguradora'
    else 'out_of_pocket'
  end,
  payment_method = case
    when sa.pre_auth_status in ('pending', 'in_review', 'approved', 'rejected') then 'aseguradora'
    else 'efectivo'
  end,
  payment_status = case
    when sa.pre_auth_status = 'rejected' then 'preauth_rechazada'
    when sa.pre_auth_status = 'approved' then 'preauth_aprobada'
    when sa.pre_auth_status in ('pending', 'in_review') then 'preauth_pendiente'
    when sa.status = 'completed' then 'pagado'
    else 'pendiente'
  end,
  quoted_price = coalesce(nullif(sa.quoted_price, 0), cs.list_price, 0),
  patient_responsibility_amount = case
    when sa.pre_auth_status in ('pending', 'in_review', 'approved', 'rejected') then 0
    else coalesce(nullif(sa.patient_responsibility_amount, 0), cs.list_price, 0)
  end,
  insurer_expected_amount = case
    when sa.pre_auth_status in ('pending', 'in_review', 'approved', 'rejected')
      then coalesce(nullif(sa.insurer_expected_amount, 0), cs.insurer_price, cs.list_price, 0)
    else 0
  end,
  amount_collected = case
    when sa.status = 'completed' and sa.pre_auth_status in ('pending', 'in_review', 'approved', 'rejected')
      then coalesce(nullif(sa.amount_collected, 0), cs.insurer_price, cs.list_price, 0)
    when sa.status = 'completed'
      then coalesce(nullif(sa.amount_collected, 0), cs.list_price, 0)
    else sa.amount_collected
  end,
  payment_confirmed_at = case
    when sa.status = 'completed' and sa.payment_confirmed_at is null then sa.updated_at
    else sa.payment_confirmed_at
  end
from public.clinic_services cs
where cs.id = sa.service_id;

create index if not exists service_appointments_clinic_payment_month_idx
  on public.service_appointments (clinic_id, scheduled_at, payment_model, payment_status);

create index if not exists service_appointments_payment_status_idx
  on public.service_appointments (payment_status);

create or replace function public.create_clinic_appointment(
  p_clinic_id uuid,
  p_patient_id text,
  p_service_id uuid,
  p_scheduled_at timestamptz,
  p_payment_model text,
  p_payment_method text default null,
  p_insurer text default null,
  p_doctor_id uuid default null,
  p_notes text default null,
  p_quoted_price numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_service public.clinic_services%rowtype;
  v_patient public.clinic_patients%rowtype;
  v_staff_id uuid;
  v_appointment public.service_appointments%rowtype;
  v_preauth public.pre_auth_requests%rowtype;
  v_payment_method text;
  v_quoted_price numeric(12,2);
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  if p_payment_model not in ('out_of_pocket', 'aseguradora') then
    return null;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = p_clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null or not private.is_clinic_staff_for(p_clinic_id) then
    return null;
  end if;

  select * into v_service
  from public.clinic_services
  where id = p_service_id
    and clinic_id = p_clinic_id
    and active = true;

  select * into v_patient
  from public.clinic_patients
  where id = p_patient_id
    and clinic_id = p_clinic_id
    and active = true;

  if v_service.id is null or v_patient.id is null then
    return null;
  end if;

  v_payment_method := coalesce(
    nullif(btrim(p_payment_method), ''),
    case when p_payment_model = 'aseguradora' then 'aseguradora' else 'efectivo' end
  );

  if v_payment_method not in ('efectivo', 'tarjeta', 'transferencia', 'aseguradora', 'cortesia', 'pendiente') then
    return null;
  end if;

  if p_payment_model = 'aseguradora' and coalesce(nullif(btrim(coalesce(p_insurer, '')), ''), v_patient.insurer) is null then
    return null;
  end if;

  v_quoted_price := coalesce(p_quoted_price, v_service.list_price, 0);

  insert into public.service_appointments (
    clinic_id,
    patient_id,
    service_id,
    doctor_id,
    scheduled_at,
    status,
    insurer,
    pre_auth_status,
    notes,
    created_by,
    payment_model,
    payment_method,
    payment_status,
    quoted_price,
    patient_responsibility_amount,
    insurer_expected_amount,
    amount_collected
  )
  values (
    p_clinic_id,
    p_patient_id,
    p_service_id,
    p_doctor_id,
    p_scheduled_at,
    'scheduled',
    case when p_payment_model = 'aseguradora' then coalesce(nullif(btrim(p_insurer), ''), v_patient.insurer) else null end,
    case when p_payment_model = 'aseguradora' then 'pending' else 'not_required' end,
    p_notes,
    v_staff_id,
    p_payment_model,
    v_payment_method,
    case when p_payment_model = 'aseguradora' then 'preauth_pendiente' else 'pendiente' end,
    v_quoted_price,
    case when p_payment_model = 'aseguradora' then 0 else v_quoted_price end,
    case when p_payment_model = 'aseguradora' then coalesce(v_service.insurer_price, v_quoted_price) else 0 end,
    0
  )
  returning * into v_appointment;

  perform private.write_clinic_audit_log(
    v_appointment.clinic_id,
    v_staff_id,
    'appointment.created',
    'service_appointments',
    v_appointment.id::text,
    v_appointment.patient_id,
    v_appointment.id,
    null,
    null,
    null,
    to_jsonb(v_appointment),
    jsonb_build_object('rpc', 'create_clinic_appointment', 'payment_model', v_appointment.payment_model, 'payment_method', v_appointment.payment_method)
  );

  if p_payment_model = 'aseguradora' then
    insert into public.pre_auth_requests (
      service_appointment_id,
      patient_id,
      clinic_id,
      insurer,
      status,
      submitted_at,
      documents,
      notes,
      created_by
    )
    values (
      v_appointment.id,
      v_appointment.patient_id,
      v_appointment.clinic_id,
      coalesce(v_appointment.insurer, v_patient.insurer, 'Aseguradora pendiente'),
      'pending',
      now(),
      '[]'::jsonb,
      'Generada automaticamente al agendar con pago por aseguradora.',
      v_staff_id
    )
    returning * into v_preauth;

    perform private.write_clinic_audit_log(
      v_appointment.clinic_id,
      v_staff_id,
      'preauth.created_from_appointment',
      'pre_auth_requests',
      v_preauth.id::text,
      v_preauth.patient_id,
      v_appointment.id,
      null,
      null,
      null,
      to_jsonb(v_preauth),
      jsonb_build_object('rpc', 'create_clinic_appointment')
    );
  end if;

  return v_appointment.id;
end;
$$;

create or replace function public.update_clinic_appointment_status(
  p_appointment_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_old public.service_appointments%rowtype;
  v_new public.service_appointments%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'escalated', 'no_show') then
    return false;
  end if;

  select * into v_old
  from public.service_appointments
  where id = p_appointment_id;

  if v_old.id is null or not private.is_clinic_staff_for(v_old.clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_old.clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null then
    return false;
  end if;

  if v_old.payment_model = 'aseguradora'
    and v_old.pre_auth_status = 'rejected'
    and p_status in ('checked_in', 'in_progress', 'completed') then
    update public.service_appointments
    set status = 'cancelled',
        payment_status = 'preauth_rechazada',
        cancellation_reason = coalesce(cancellation_reason, 'Pre-autorizacion rechazada por aseguradora. Servicio cancelado automaticamente.'),
        cancelled_at = coalesce(cancelled_at, now()),
        updated_at = now()
    where id = p_appointment_id
    returning * into v_new;

    perform private.write_clinic_audit_log(
      v_new.clinic_id,
      v_staff_id,
      'appointment.cancelled_preauth_rejected',
      'service_appointments',
      v_new.id::text,
      v_new.patient_id,
      v_new.id,
      null,
      null,
      to_jsonb(v_old),
      to_jsonb(v_new),
      jsonb_build_object('blocked_status', p_status, 'from_status', v_old.status, 'to_status', v_new.status, 'rpc', 'update_clinic_appointment_status')
    );

    return true;
  end if;

  if v_old.payment_model = 'aseguradora'
    and v_old.pre_auth_status <> 'approved'
    and p_status in ('in_progress', 'completed') then
    perform private.write_clinic_audit_log(
      v_old.clinic_id,
      v_staff_id,
      'appointment.status_blocked_preauth_not_approved',
      'service_appointments',
      v_old.id::text,
      v_old.patient_id,
      v_old.id,
      null,
      null,
      to_jsonb(v_old),
      to_jsonb(v_old),
      jsonb_build_object('blocked_status', p_status, 'pre_auth_status', v_old.pre_auth_status, 'rpc', 'update_clinic_appointment_status')
    );

    return false;
  end if;

  update public.service_appointments
  set status = p_status,
      payment_status = case
        when p_status in ('cancelled', 'no_show') then 'cancelado'
        when p_status = 'completed' and payment_model = 'out_of_pocket' and payment_method = 'cortesia' then 'cortesia'
        when p_status = 'completed' then 'pagado'
        when payment_model = 'aseguradora' and pre_auth_status = 'approved' then 'preauth_aprobada'
        when payment_model = 'aseguradora' and pre_auth_status in ('pending', 'in_review') then 'preauth_pendiente'
        else payment_status
      end,
      amount_collected = case
        when p_status = 'completed' and payment_method = 'cortesia' then 0
        when p_status = 'completed' and payment_model = 'aseguradora' then coalesce(nullif(amount_collected, 0), insurer_expected_amount, quoted_price, 0)
        when p_status = 'completed' then coalesce(nullif(amount_collected, 0), patient_responsibility_amount, quoted_price, 0)
        else amount_collected
      end,
      payment_confirmed_at = case
        when p_status = 'completed' then coalesce(payment_confirmed_at, now())
        else payment_confirmed_at
      end,
      cancelled_at = case
        when p_status in ('cancelled', 'no_show') then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      updated_at = now()
  where id = p_appointment_id
  returning * into v_new;

  if v_new.id is null then
    return false;
  end if;

  perform private.write_clinic_audit_log(
    v_new.clinic_id,
    v_staff_id,
    'appointment.status_updated',
    'service_appointments',
    v_new.id::text,
    v_new.patient_id,
    v_new.id,
    null,
    null,
    to_jsonb(v_old),
    to_jsonb(v_new),
    jsonb_build_object('from_status', v_old.status, 'to_status', v_new.status, 'rpc', 'update_clinic_appointment_status')
  );

  return true;
end;
$$;

create or replace function public.update_clinic_preauth_status(
  p_pre_auth_id uuid,
  p_status text,
  p_folio text default null
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_old public.pre_auth_requests%rowtype;
  v_new public.pre_auth_requests%rowtype;
  v_old_appointment public.service_appointments%rowtype;
  v_new_appointment public.service_appointments%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('pending', 'in_review', 'approved', 'rejected', 'expired') then
    return false;
  end if;

  select * into v_old
  from public.pre_auth_requests
  where id = p_pre_auth_id;

  if v_old.id is null or not private.is_clinic_staff_for(v_old.clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_old.clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null then
    return false;
  end if;

  update public.pre_auth_requests
  set status = p_status,
      folio_aseguradora = coalesce(nullif(btrim(p_folio), ''), folio_aseguradora),
      resolved_at = case
        when p_status in ('approved', 'rejected', 'expired') then now()
        else resolved_at
      end,
      updated_at = now()
  where id = p_pre_auth_id
  returning * into v_new;

  if v_new.id is null then
    return false;
  end if;

  select * into v_old_appointment
  from public.service_appointments
  where id = v_new.service_appointment_id;

  update public.service_appointments
  set pre_auth_status = case
        when p_status = 'pending' then 'pending'
        when p_status = 'in_review' then 'in_review'
        when p_status = 'approved' then 'approved'
        when p_status in ('rejected', 'expired') then 'rejected'
        else pre_auth_status
      end,
      payment_status = case
        when p_status = 'approved' then 'preauth_aprobada'
        when p_status in ('pending', 'in_review') then 'preauth_pendiente'
        when p_status in ('rejected', 'expired') then 'preauth_rechazada'
        else payment_status
      end,
      status = case
        when p_status in ('rejected', 'expired') and status in ('scheduled', 'checked_in') then 'cancelled'
        else status
      end,
      cancellation_reason = case
        when p_status in ('rejected', 'expired') and status in ('scheduled', 'checked_in')
          then coalesce(cancellation_reason, 'Pre-autorizacion rechazada/vencida por aseguradora. Servicio cancelado automaticamente.')
        else cancellation_reason
      end,
      cancelled_at = case
        when p_status in ('rejected', 'expired') and status in ('scheduled', 'checked_in') then coalesce(cancelled_at, now())
        else cancelled_at
      end,
      updated_at = now()
  where id = v_new.service_appointment_id
  returning * into v_new_appointment;

  perform private.write_clinic_audit_log(
    v_new.clinic_id,
    v_staff_id,
    'preauth.status_updated',
    'pre_auth_requests',
    v_new.id::text,
    v_new.patient_id,
    v_new.service_appointment_id,
    null,
    null,
    to_jsonb(v_old),
    to_jsonb(v_new),
    jsonb_build_object('from_status', v_old.status, 'to_status', v_new.status, 'rpc', 'update_clinic_preauth_status')
  );

  if v_new_appointment.id is not null then
    perform private.write_clinic_audit_log(
      v_new_appointment.clinic_id,
      v_staff_id,
      case when p_status in ('rejected', 'expired') and v_old_appointment.status <> v_new_appointment.status
        then 'appointment.cancelled_preauth_rejected'
        else 'appointment.preauth_synced'
      end,
      'service_appointments',
      v_new_appointment.id::text,
      v_new_appointment.patient_id,
      v_new_appointment.id,
      null,
      null,
      to_jsonb(v_old_appointment),
      to_jsonb(v_new_appointment),
      jsonb_build_object('pre_auth_request_id', v_new.id, 'preauth_status', p_status, 'rpc', 'update_clinic_preauth_status')
    );
  end if;

  return true;
end;
$$;

revoke execute on function public.create_clinic_appointment(uuid, text, uuid, timestamptz, text, text, text, uuid, text, numeric) from public, anon;
grant execute on function public.create_clinic_appointment(uuid, text, uuid, timestamptz, text, text, text, uuid, text, numeric) to authenticated;

revoke execute on function public.update_clinic_appointment_status(uuid, text) from public, anon;
revoke execute on function public.update_clinic_preauth_status(uuid, text, text) from public, anon;
grant execute on function public.update_clinic_appointment_status(uuid, text) to authenticated;
grant execute on function public.update_clinic_preauth_status(uuid, text, text) to authenticated;

create or replace view public.clinic_financial_metrics_monthly
with (security_invoker = true)
as
select
  sa.clinic_id,
  date_trunc('month', sa.scheduled_at)::date as month,
  count(*)::int as booked_services,
  count(*) filter (where sa.status = 'completed')::int as completed_services,
  count(*) filter (where sa.status in ('cancelled', 'no_show'))::int as cancelled_services,
  count(*) filter (where sa.cancellation_reason ilike '%pre-autorizacion%' or sa.payment_status = 'preauth_rechazada')::int as preauth_rejected_cancelled,
  count(distinct sa.patient_id)::int as unique_patients,
  coalesce(sum(sa.quoted_price), 0)::numeric(12,2) as booked_gross_amount,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed'), 0)::numeric(12,2) as collected_amount,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed' and sa.payment_model = 'out_of_pocket'), 0)::numeric(12,2) as out_of_pocket_collected,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed' and sa.payment_model = 'aseguradora'), 0)::numeric(12,2) as insurer_collected,
  coalesce(sum(sa.insurer_expected_amount) filter (where sa.payment_model = 'aseguradora' and sa.payment_status in ('preauth_pendiente', 'preauth_aprobada')), 0)::numeric(12,2) as insurer_pipeline_amount,
  coalesce(sum(greatest(sa.amount_collected - coalesce(cs.cost_basis, 0), 0)) filter (where sa.status = 'completed'), 0)::numeric(12,2) as estimated_margin
from public.service_appointments sa
left join public.clinic_services cs on cs.id = sa.service_id
group by sa.clinic_id, date_trunc('month', sa.scheduled_at)::date;

create or replace view public.clinic_revenue_by_payment_method_monthly
with (security_invoker = true)
as
select
  clinic_id,
  date_trunc('month', scheduled_at)::date as month,
  payment_model,
  payment_method,
  payment_status,
  count(*)::int as services,
  coalesce(sum(amount_collected) filter (where status = 'completed'), 0)::numeric(12,2) as collected_amount,
  coalesce(sum(quoted_price), 0)::numeric(12,2) as booked_amount
from public.service_appointments
group by clinic_id, date_trunc('month', scheduled_at)::date, payment_model, payment_method, payment_status;

create or replace view public.clinic_service_financials_monthly
with (security_invoker = true)
as
select
  sa.clinic_id,
  date_trunc('month', sa.scheduled_at)::date as month,
  cs.service_type,
  cs.name as service_name,
  count(*)::int as booked_services,
  count(*) filter (where sa.status = 'completed')::int as completed_services,
  coalesce(sum(sa.amount_collected) filter (where sa.status = 'completed'), 0)::numeric(12,2) as collected_amount,
  coalesce(avg(sa.amount_collected) filter (where sa.status = 'completed'), 0)::numeric(12,2) as avg_ticket,
  coalesce(sum(greatest(sa.amount_collected - coalesce(cs.cost_basis, 0), 0)) filter (where sa.status = 'completed'), 0)::numeric(12,2) as estimated_margin
from public.service_appointments sa
join public.clinic_services cs on cs.id = sa.service_id
group by sa.clinic_id, date_trunc('month', sa.scheduled_at)::date, cs.service_type, cs.name;

revoke all on table public.clinic_financial_metrics_monthly from anon;
revoke all on table public.clinic_revenue_by_payment_method_monthly from anon;
revoke all on table public.clinic_service_financials_monthly from anon;
grant select on table public.clinic_financial_metrics_monthly to authenticated;
grant select on table public.clinic_revenue_by_payment_method_monthly to authenticated;
grant select on table public.clinic_service_financials_monthly to authenticated;
