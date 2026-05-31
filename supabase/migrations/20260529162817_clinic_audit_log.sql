-- Mini Plan 3: append-only audit log for clinic RPC mutations.
-- The audit log is written by RPCs with semantic context, not by generic triggers.

create table if not exists public.clinic_audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  actor_user_id uuid null references auth.users(id),
  actor_staff_id uuid null references public.clinic_staff(id),
  action text not null,
  entity_table text not null,
  entity_id text not null,
  patient_id text null references public.clinic_patients(id),
  appointment_id uuid null references public.service_appointments(id),
  conversation_id uuid null references public.clinic_conversations(id),
  resource_assignment_id uuid null references public.clinic_resource_assignments(id),
  old_data jsonb null,
  new_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint clinic_audit_log_action_not_blank check (btrim(action) <> ''),
  constraint clinic_audit_log_entity_table_not_blank check (btrim(entity_table) <> ''),
  constraint clinic_audit_log_entity_id_not_blank check (btrim(entity_id) <> '')
);

alter table public.clinic_audit_log enable row level security;

revoke all on table public.clinic_audit_log from anon;
revoke all on table public.clinic_audit_log from authenticated;
grant select on table public.clinic_audit_log to authenticated;

drop policy if exists clinic_audit_log_select_own_clinic on public.clinic_audit_log;
create policy clinic_audit_log_select_own_clinic
on public.clinic_audit_log
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

create index if not exists clinic_audit_log_clinic_created_idx
  on public.clinic_audit_log (clinic_id, created_at desc);

create index if not exists clinic_audit_log_actor_user_created_idx
  on public.clinic_audit_log (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists clinic_audit_log_actor_staff_created_idx
  on public.clinic_audit_log (actor_staff_id, created_at desc)
  where actor_staff_id is not null;

create index if not exists clinic_audit_log_patient_created_idx
  on public.clinic_audit_log (patient_id, created_at desc)
  where patient_id is not null;

create index if not exists clinic_audit_log_appointment_created_idx
  on public.clinic_audit_log (appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists clinic_audit_log_conversation_created_idx
  on public.clinic_audit_log (conversation_id, created_at desc)
  where conversation_id is not null;

create index if not exists clinic_audit_log_resource_assignment_created_idx
  on public.clinic_audit_log (resource_assignment_id, created_at desc)
  where resource_assignment_id is not null;

create index if not exists clinic_audit_log_entity_idx
  on public.clinic_audit_log (entity_table, entity_id);

create or replace function private.write_clinic_audit_log(
  p_clinic_id uuid,
  p_actor_staff_id uuid,
  p_action text,
  p_entity_table text,
  p_entity_id text,
  p_patient_id text default null,
  p_appointment_id uuid default null,
  p_conversation_id uuid default null,
  p_resource_assignment_id uuid default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_audit_id uuid;
begin
  if p_clinic_id is null or btrim(coalesce(p_action, '')) = '' then
    raise exception 'invalid audit log input';
  end if;

  insert into public.clinic_audit_log (
    clinic_id,
    actor_user_id,
    actor_staff_id,
    action,
    entity_table,
    entity_id,
    patient_id,
    appointment_id,
    conversation_id,
    resource_assignment_id,
    old_data,
    new_data,
    metadata
  )
  values (
    p_clinic_id,
    (select auth.uid()),
    p_actor_staff_id,
    p_action,
    p_entity_table,
    p_entity_id,
    p_patient_id,
    p_appointment_id,
    p_conversation_id,
    p_resource_assignment_id,
    p_old_data,
    p_new_data,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke execute on function private.write_clinic_audit_log(
  uuid, uuid, text, text, text, text, uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;

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

  update public.service_appointments
  set status = p_status,
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

  return true;
end;
$$;

create or replace function public.send_clinic_staff_message(
  p_conversation_id uuid,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_conversation public.clinic_conversations%rowtype;
  v_message public.clinic_chat_messages%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null or btrim(coalesce(p_body, '')) = '' then
    return false;
  end if;

  select * into v_conversation
  from public.clinic_conversations
  where id = p_conversation_id;

  if v_conversation.id is null or not private.is_clinic_staff_for(v_conversation.clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_conversation.clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null then
    return false;
  end if;

  insert into public.clinic_chat_messages (
    conversation_id,
    clinic_id,
    t,
    body,
    tm,
    author_staff_id
  )
  values (
    p_conversation_id,
    v_conversation.clinic_id,
    'out',
    btrim(p_body),
    'hoy ' || to_char(now(), 'HH24:MI'),
    v_staff_id
  )
  returning * into v_message;

  perform private.write_clinic_audit_log(
    v_message.clinic_id,
    v_staff_id,
    'conversation.message_sent',
    'clinic_chat_messages',
    v_message.id::text,
    v_conversation.patient_id,
    v_conversation.related_appointment_id,
    v_message.conversation_id,
    null,
    null,
    to_jsonb(v_message),
    jsonb_build_object('message_type', v_message.t, 'rpc', 'send_clinic_staff_message')
  );

  return true;
end;
$$;

create or replace function public.update_clinic_conversation_status(
  p_conversation_id uuid,
  p_status text,
  p_assigned_to uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_old public.clinic_conversations%rowtype;
  v_new public.clinic_conversations%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('bot', 'waiting_human', 'in_progress', 'resolved', 'escalated') then
    return false;
  end if;

  select * into v_old
  from public.clinic_conversations
  where id = p_conversation_id;

  if v_old.id is null or not private.is_clinic_staff_for(v_old.clinic_id) then
    return false;
  end if;

  if p_assigned_to is not null and not private.staff_matches_clinic(p_assigned_to, v_old.clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_old.clinic_id
    and active = true
  order by created_at
  limit 1;

  update public.clinic_conversations
  set status = p_status,
      assigned_to = p_assigned_to,
      updated_at = now()
  where id = p_conversation_id
  returning * into v_new;

  if v_new.id is null then
    return false;
  end if;

  perform private.write_clinic_audit_log(
    v_new.clinic_id,
    v_staff_id,
    'conversation.status_updated',
    'clinic_conversations',
    v_new.id::text,
    v_new.patient_id,
    v_new.related_appointment_id,
    v_new.id,
    null,
    to_jsonb(v_old),
    to_jsonb(v_new),
    jsonb_build_object(
      'from_status', v_old.status,
      'to_status', v_new.status,
      'from_assigned_to', v_old.assigned_to,
      'to_assigned_to', v_new.assigned_to,
      'rpc', 'update_clinic_conversation_status'
    )
  );

  return true;
end;
$$;

create or replace function public.mark_clinic_conversation_read(
  p_conversation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_old public.clinic_conversations%rowtype;
  v_new public.clinic_conversations%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select * into v_old
  from public.clinic_conversations
  where id = p_conversation_id;

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

  update public.clinic_conversations
  set unread_count = 0,
      updated_at = now()
  where id = p_conversation_id
  returning * into v_new;

  if v_new.id is null then
    return false;
  end if;

  perform private.write_clinic_audit_log(
    v_new.clinic_id,
    v_staff_id,
    'conversation.marked_read',
    'clinic_conversations',
    v_new.id::text,
    v_new.patient_id,
    v_new.related_appointment_id,
    v_new.id,
    null,
    to_jsonb(v_old),
    to_jsonb(v_new),
    jsonb_build_object('from_unread_count', v_old.unread_count, 'to_unread_count', v_new.unread_count, 'rpc', 'mark_clinic_conversation_read')
  );

  return true;
end;
$$;

create or replace function public.assign_clinic_resource(
  p_resource_id uuid,
  p_appointment_id uuid,
  p_expected_end_minutes int default 60
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_resource_clinic_id uuid;
  v_appointment public.service_appointments%rowtype;
  v_staff_id uuid;
  v_expected_minutes int := coalesce(p_expected_end_minutes, 60);
  v_old_assignment public.clinic_resource_assignments%rowtype;
  v_updated_assignment public.clinic_resource_assignments%rowtype;
  v_new_assignment public.clinic_resource_assignments%rowtype;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if v_expected_minutes < 1 or v_expected_minutes > 1440 then
    return false;
  end if;

  select clinic_id into v_resource_clinic_id
  from public.clinic_resources
  where id = p_resource_id
    and active = true;

  select * into v_appointment
  from public.service_appointments
  where id = p_appointment_id;

  if v_resource_clinic_id is null
    or v_appointment.id is null
    or v_resource_clinic_id <> v_appointment.clinic_id
    or not private.is_clinic_staff_for(v_resource_clinic_id) then
    return false;
  end if;

  if not private.clinic_patient_matches_clinic(v_appointment.patient_id, v_resource_clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_resource_clinic_id
    and active = true
  order by created_at
  limit 1;

  if v_staff_id is null then
    return false;
  end if;

  for v_old_assignment in
    select *
    from public.clinic_resource_assignments
    where resource_id = p_resource_id
      and status = 'active'
  loop
    update public.clinic_resource_assignments
    set status = 'freed',
        ended_at = now(),
        assigned_by = coalesce(assigned_by, v_staff_id)
    where id = v_old_assignment.id
    returning * into v_updated_assignment;

    perform private.write_clinic_audit_log(
      v_updated_assignment.clinic_id,
      v_staff_id,
      'resource_assignment.auto_freed_for_reassignment',
      'clinic_resource_assignments',
      v_updated_assignment.id::text,
      v_updated_assignment.patient_id,
      v_updated_assignment.appointment_id,
      null,
      v_updated_assignment.id,
      to_jsonb(v_old_assignment),
      to_jsonb(v_updated_assignment),
      jsonb_build_object('resource_id', v_updated_assignment.resource_id, 'rpc', 'assign_clinic_resource')
    );
  end loop;

  insert into public.clinic_resource_assignments (
    resource_id,
    appointment_id,
    clinic_id,
    patient_id,
    expected_end_at,
    assigned_by,
    manual
  )
  values (
    p_resource_id,
    p_appointment_id,
    v_resource_clinic_id,
    v_appointment.patient_id,
    now() + make_interval(mins => v_expected_minutes),
    v_staff_id,
    true
  )
  returning * into v_new_assignment;

  perform private.write_clinic_audit_log(
    v_new_assignment.clinic_id,
    v_staff_id,
    'resource_assignment.assigned',
    'clinic_resource_assignments',
    v_new_assignment.id::text,
    v_new_assignment.patient_id,
    v_new_assignment.appointment_id,
    null,
    v_new_assignment.id,
    null,
    to_jsonb(v_new_assignment),
    jsonb_build_object('resource_id', v_new_assignment.resource_id, 'expected_end_minutes', v_expected_minutes, 'rpc', 'assign_clinic_resource')
  );

  return true;
end;
$$;

create or replace function public.free_clinic_resource_assignment(
  p_assignment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = private, public, auth
as $$
declare
  v_old public.clinic_resource_assignments%rowtype;
  v_new public.clinic_resource_assignments%rowtype;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select * into v_old
  from public.clinic_resource_assignments
  where id = p_assignment_id;

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

  update public.clinic_resource_assignments
  set status = 'freed',
      ended_at = now(),
      assigned_by = coalesce(assigned_by, v_staff_id)
  where id = p_assignment_id
    and status = 'active'
  returning * into v_new;

  if v_new.id is null then
    return false;
  end if;

  perform private.write_clinic_audit_log(
    v_new.clinic_id,
    v_staff_id,
    'resource_assignment.freed',
    'clinic_resource_assignments',
    v_new.id::text,
    v_new.patient_id,
    v_new.appointment_id,
    null,
    v_new.id,
    to_jsonb(v_old),
    to_jsonb(v_new),
    jsonb_build_object('resource_id', v_new.resource_id, 'rpc', 'free_clinic_resource_assignment')
  );

  return true;
end;
$$;

revoke execute on function public.update_clinic_appointment_status(uuid, text) from public, anon;
revoke execute on function public.update_clinic_preauth_status(uuid, text, text) from public, anon;
revoke execute on function public.send_clinic_staff_message(uuid, text) from public, anon;
revoke execute on function public.update_clinic_conversation_status(uuid, text, uuid) from public, anon;
revoke execute on function public.mark_clinic_conversation_read(uuid) from public, anon;
revoke execute on function public.assign_clinic_resource(uuid, uuid, int) from public, anon;
revoke execute on function public.free_clinic_resource_assignment(uuid) from public, anon;

grant execute on function public.update_clinic_appointment_status(uuid, text) to authenticated;
grant execute on function public.update_clinic_preauth_status(uuid, text, text) to authenticated;
grant execute on function public.send_clinic_staff_message(uuid, text) to authenticated;
grant execute on function public.update_clinic_conversation_status(uuid, text, uuid) to authenticated;
grant execute on function public.mark_clinic_conversation_read(uuid) to authenticated;
grant execute on function public.assign_clinic_resource(uuid, uuid, int) to authenticated;
grant execute on function public.free_clinic_resource_assignment(uuid) to authenticated;
