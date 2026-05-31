-- Mini Plan 2: RLS/grants hardening and RPC mutation boundary for clinic module.
-- This migration keeps reads available to clinic staff, removes broad table
-- privileges, replaces ALL policies, and moves sensitive writes behind RPCs.

create or replace function private.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select clinic_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and active = true
  order by created_at
  limit 1;
$$;

create or replace function private.can_access_clinic_patient(p_patient_id text)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_patients cp
    where cp.id = p_patient_id
      and cp.active = true
      and private.is_clinic_staff_for(cp.clinic_id)
  );
$$;

create or replace function private.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_conversations cc
    where cc.id = p_conversation_id
      and private.is_clinic_staff_for(cc.clinic_id)
  );
$$;

create or replace function private.can_access_resource_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_resource_assignments cra
    where cra.id = p_assignment_id
      and private.is_clinic_staff_for(cra.clinic_id)
  );
$$;

create or replace function private.clinic_patient_matches_clinic(
  p_patient_id text,
  p_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_patients cp
    where cp.id = p_patient_id
      and cp.clinic_id = p_clinic_id
      and cp.active = true
  );
$$;

create or replace function private.clinic_service_matches_clinic(
  p_service_id uuid,
  p_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_services cs
    where cs.id = p_service_id
      and cs.clinic_id = p_clinic_id
  );
$$;

create or replace function private.appointment_matches_clinic_patient(
  p_appointment_id uuid,
  p_clinic_id uuid,
  p_patient_id text
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.service_appointments sa
    where sa.id = p_appointment_id
      and sa.clinic_id = p_clinic_id
      and sa.patient_id = p_patient_id
  );
$$;

create or replace function private.conversation_matches_clinic(
  p_conversation_id uuid,
  p_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_conversations cc
    where cc.id = p_conversation_id
      and cc.clinic_id = p_clinic_id
  );
$$;

create or replace function private.resource_matches_clinic(
  p_resource_id uuid,
  p_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select exists (
    select 1
    from public.clinic_resources cr
    where cr.id = p_resource_id
      and cr.clinic_id = p_clinic_id
      and cr.active = true
  );
$$;

create or replace function private.staff_matches_clinic(
  p_staff_id uuid,
  p_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select p_staff_id is null or exists (
    select 1
    from public.clinic_staff cs
    where cs.id = p_staff_id
      and cs.clinic_id = p_clinic_id
      and cs.active = true
  );
$$;

create or replace function private.assert_clinic_integrity()
returns trigger
language plpgsql
security definer
set search_path = private, public, auth
as $$
begin
  if tg_table_name = 'service_appointments' then
    if not private.clinic_patient_matches_clinic(new.patient_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if not private.clinic_service_matches_clinic(new.service_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
  elsif tg_table_name = 'pre_auth_requests' then
    if not private.clinic_patient_matches_clinic(new.patient_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if not private.appointment_matches_clinic_patient(new.service_appointment_id, new.clinic_id, new.patient_id) then
      raise exception 'clinic integrity violation';
    end if;
  elsif tg_table_name = 'service_results' then
    if not private.clinic_patient_matches_clinic(new.patient_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if not private.appointment_matches_clinic_patient(new.service_appointment_id, new.clinic_id, new.patient_id) then
      raise exception 'clinic integrity violation';
    end if;
  elsif tg_table_name = 'clinic_conversations' then
    if not private.clinic_patient_matches_clinic(new.patient_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if new.assigned_to is not null and not private.staff_matches_clinic(new.assigned_to, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if new.related_appointment_id is not null
      and not private.appointment_matches_clinic_patient(new.related_appointment_id, new.clinic_id, new.patient_id) then
      raise exception 'clinic integrity violation';
    end if;
  elsif tg_table_name = 'clinic_chat_messages' then
    if not private.conversation_matches_clinic(new.conversation_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if new.author_staff_id is not null and not private.staff_matches_clinic(new.author_staff_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
  elsif tg_table_name = 'clinic_resource_assignments' then
    if not private.clinic_patient_matches_clinic(new.patient_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if not private.resource_matches_clinic(new.resource_id, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
    if not private.appointment_matches_clinic_patient(new.appointment_id, new.clinic_id, new.patient_id) then
      raise exception 'clinic integrity violation';
    end if;
    if new.assigned_by is not null and not private.staff_matches_clinic(new.assigned_by, new.clinic_id) then
      raise exception 'clinic integrity violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assert_service_appointments_clinic_integrity on public.service_appointments;
create trigger trg_assert_service_appointments_clinic_integrity
before insert or update of clinic_id, patient_id, service_id on public.service_appointments
for each row execute function private.assert_clinic_integrity();

drop trigger if exists trg_assert_pre_auth_requests_clinic_integrity on public.pre_auth_requests;
create trigger trg_assert_pre_auth_requests_clinic_integrity
before insert or update of clinic_id, patient_id, service_appointment_id on public.pre_auth_requests
for each row execute function private.assert_clinic_integrity();

drop trigger if exists trg_assert_service_results_clinic_integrity on public.service_results;
create trigger trg_assert_service_results_clinic_integrity
before insert or update of clinic_id, patient_id, service_appointment_id on public.service_results
for each row execute function private.assert_clinic_integrity();

drop trigger if exists trg_assert_clinic_conversations_clinic_integrity on public.clinic_conversations;
create trigger trg_assert_clinic_conversations_clinic_integrity
before insert or update of clinic_id, patient_id, assigned_to, related_appointment_id on public.clinic_conversations
for each row execute function private.assert_clinic_integrity();

drop trigger if exists trg_assert_clinic_chat_messages_clinic_integrity on public.clinic_chat_messages;
create trigger trg_assert_clinic_chat_messages_clinic_integrity
before insert or update of clinic_id, conversation_id, author_staff_id on public.clinic_chat_messages
for each row execute function private.assert_clinic_integrity();

drop trigger if exists trg_assert_clinic_resource_assignments_clinic_integrity on public.clinic_resource_assignments;
create trigger trg_assert_clinic_resource_assignments_clinic_integrity
before insert or update of clinic_id, patient_id, resource_id, appointment_id, assigned_by on public.clinic_resource_assignments
for each row execute function private.assert_clinic_integrity();

create index if not exists clinic_chat_messages_author_staff_id_idx
  on public.clinic_chat_messages (author_staff_id)
  where author_staff_id is not null;

create index if not exists clinic_conversations_related_appointment_id_idx
  on public.clinic_conversations (related_appointment_id)
  where related_appointment_id is not null;

create index if not exists clinic_resource_assignments_assigned_by_idx
  on public.clinic_resource_assignments (assigned_by)
  where assigned_by is not null;

create index if not exists clinical_escalations_service_appointment_id_idx
  on public.clinical_escalations (service_appointment_id);

create index if not exists clinical_escalations_triggered_by_idx
  on public.clinical_escalations (triggered_by)
  where triggered_by is not null;

create index if not exists clinics_hub_clinic_id_idx
  on public.clinics (hub_clinic_id)
  where hub_clinic_id is not null;

create index if not exists pre_auth_requests_created_by_idx
  on public.pre_auth_requests (created_by)
  where created_by is not null;

create index if not exists service_appointments_created_by_idx
  on public.service_appointments (created_by)
  where created_by is not null;

create index if not exists service_appointments_doctor_id_idx
  on public.service_appointments (doctor_id)
  where doctor_id is not null;

create index if not exists service_appointments_service_id_idx
  on public.service_appointments (service_id);

create index if not exists service_results_reviewed_by_idx
  on public.service_results (reviewed_by)
  where reviewed_by is not null;

alter table public.clinics enable row level security;
alter table public.clinic_staff enable row level security;
alter table public.clinic_services enable row level security;
alter table public.clinic_patients enable row level security;
alter table public.service_appointments enable row level security;
alter table public.pre_auth_requests enable row level security;
alter table public.service_results enable row level security;
alter table public.clinical_escalations enable row level security;
alter table public.clinic_conversations enable row level security;
alter table public.clinic_chat_messages enable row level security;
alter table public.clinic_resources enable row level security;
alter table public.clinic_resource_assignments enable row level security;

revoke all on table
  public.clinics,
  public.clinic_staff,
  public.clinic_services,
  public.clinic_patients,
  public.service_appointments,
  public.pre_auth_requests,
  public.service_results,
  public.clinical_escalations,
  public.clinic_conversations,
  public.clinic_chat_messages,
  public.clinic_resources,
  public.clinic_resource_assignments
from anon;

revoke all on table
  public.clinics,
  public.clinic_staff,
  public.clinic_services,
  public.clinic_patients,
  public.service_appointments,
  public.pre_auth_requests,
  public.service_results,
  public.clinical_escalations,
  public.clinic_conversations,
  public.clinic_chat_messages,
  public.clinic_resources,
  public.clinic_resource_assignments
from authenticated;

grant select on table
  public.clinics,
  public.clinic_staff,
  public.clinic_services,
  public.clinic_patients,
  public.service_appointments,
  public.pre_auth_requests,
  public.service_results,
  public.clinical_escalations,
  public.clinic_conversations,
  public.clinic_chat_messages,
  public.clinic_resources,
  public.clinic_resource_assignments
to authenticated;

grant insert, update on table public.clinic_patients to authenticated;

drop policy if exists staff_full_access_messages on public.clinic_chat_messages;
drop policy if exists staff_full_access_conversations on public.clinic_conversations;
drop policy if exists staff_full_access_resource_assignments on public.clinic_resource_assignments;
drop policy if exists staff_full_access_resources on public.clinic_resources;

drop policy if exists clinic_staff_lee_su_clinica on public.clinics;
create policy clinic_staff_select_own_clinic
on public.clinics
for select
to authenticated
using (private.is_clinic_staff_for(id));

drop policy if exists staff_lee_su_propio_registro on public.clinic_staff;
create policy clinic_staff_select_own_record
on public.clinic_staff
for select
to authenticated
using (user_id = (select auth.uid()) and active = true);

drop policy if exists staff_lee_servicios_de_su_clinica on public.clinic_services;
create policy clinic_services_select_own_clinic
on public.clinic_services
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_resources_select_own_clinic on public.clinic_resources;
create policy clinic_resources_select_own_clinic
on public.clinic_resources
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_resources_insert_own_clinic on public.clinic_resources;
create policy clinic_resources_insert_own_clinic
on public.clinic_resources
for insert
to authenticated
with check (false);

drop policy if exists clinic_resources_update_own_clinic on public.clinic_resources;
create policy clinic_resources_update_own_clinic
on public.clinic_resources
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (false);

drop policy if exists staff_lee_citas_de_su_clinica on public.service_appointments;
create policy service_appointments_select_own_clinic
on public.service_appointments
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists staff_crea_citas_de_su_clinica on public.service_appointments;
create policy service_appointments_insert_own_clinic
on public.service_appointments
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.clinic_service_matches_clinic(service_id, clinic_id)
);

drop policy if exists staff_actualiza_citas_de_su_clinica on public.service_appointments;
create policy service_appointments_update_own_clinic
on public.service_appointments
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.clinic_service_matches_clinic(service_id, clinic_id)
);

drop policy if exists staff_lee_preauth_de_su_clinica on public.pre_auth_requests;
create policy pre_auth_requests_select_own_clinic
on public.pre_auth_requests
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists staff_crea_preauth_de_su_clinica on public.pre_auth_requests;
create policy pre_auth_requests_insert_own_clinic
on public.pre_auth_requests
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.appointment_matches_clinic_patient(service_appointment_id, clinic_id, patient_id)
);

drop policy if exists staff_actualiza_preauth_de_su_clinica on public.pre_auth_requests;
create policy pre_auth_requests_update_own_clinic
on public.pre_auth_requests
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.appointment_matches_clinic_patient(service_appointment_id, clinic_id, patient_id)
);

drop policy if exists staff_lee_resultados_de_su_clinica on public.service_results;
create policy service_results_select_own_clinic
on public.service_results
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists staff_crea_resultados_de_su_clinica on public.service_results;
create policy service_results_insert_own_clinic
on public.service_results
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.appointment_matches_clinic_patient(service_appointment_id, clinic_id, patient_id)
);

drop policy if exists clinical_escalations_select_own_clinic on public.clinical_escalations;
drop policy if exists staff_lee_escalaciones_de_su_clinica on public.clinical_escalations;
create policy clinical_escalations_select_own_clinic
on public.clinical_escalations
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinical_escalations_insert_own_clinic on public.clinical_escalations;
drop policy if exists staff_crea_escalacion on public.clinical_escalations;
create policy clinical_escalations_insert_own_clinic
on public.clinical_escalations
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.can_access_appointment(service_appointment_id)
);

drop policy if exists clinical_escalations_update_own_clinic on public.clinical_escalations;
drop policy if exists staff_resuelve_escalacion on public.clinical_escalations;
create policy clinical_escalations_update_own_clinic
on public.clinical_escalations
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.can_access_appointment(service_appointment_id)
);

drop policy if exists clinic_conversations_select_own_clinic on public.clinic_conversations;
create policy clinic_conversations_select_own_clinic
on public.clinic_conversations
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_conversations_insert_own_clinic on public.clinic_conversations;
create policy clinic_conversations_insert_own_clinic
on public.clinic_conversations
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.staff_matches_clinic(assigned_to, clinic_id)
);

drop policy if exists clinic_conversations_update_own_clinic on public.clinic_conversations;
create policy clinic_conversations_update_own_clinic
on public.clinic_conversations
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.staff_matches_clinic(assigned_to, clinic_id)
);

drop policy if exists clinic_chat_messages_select_own_clinic on public.clinic_chat_messages;
create policy clinic_chat_messages_select_own_clinic
on public.clinic_chat_messages
for select
to authenticated
using (
  private.is_clinic_staff_for(clinic_id)
  and private.can_access_conversation(conversation_id)
);

drop policy if exists clinic_chat_messages_insert_own_clinic on public.clinic_chat_messages;
create policy clinic_chat_messages_insert_own_clinic
on public.clinic_chat_messages
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.conversation_matches_clinic(conversation_id, clinic_id)
  and private.staff_matches_clinic(author_staff_id, clinic_id)
);

drop policy if exists clinic_chat_messages_update_own_clinic on public.clinic_chat_messages;
create policy clinic_chat_messages_update_own_clinic
on public.clinic_chat_messages
for update
to authenticated
using (
  private.is_clinic_staff_for(clinic_id)
  and private.can_access_conversation(conversation_id)
)
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.conversation_matches_clinic(conversation_id, clinic_id)
  and private.staff_matches_clinic(author_staff_id, clinic_id)
);

drop policy if exists clinic_resource_assignments_select_own_clinic on public.clinic_resource_assignments;
create policy clinic_resource_assignments_select_own_clinic
on public.clinic_resource_assignments
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_resource_assignments_insert_own_clinic on public.clinic_resource_assignments;
create policy clinic_resource_assignments_insert_own_clinic
on public.clinic_resource_assignments
for insert
to authenticated
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.resource_matches_clinic(resource_id, clinic_id)
  and private.appointment_matches_clinic_patient(appointment_id, clinic_id, patient_id)
  and private.staff_matches_clinic(assigned_by, clinic_id)
);

drop policy if exists clinic_resource_assignments_update_own_clinic on public.clinic_resource_assignments;
create policy clinic_resource_assignments_update_own_clinic
on public.clinic_resource_assignments
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (
  private.is_clinic_staff_for(clinic_id)
  and private.clinic_patient_matches_clinic(patient_id, clinic_id)
  and private.resource_matches_clinic(resource_id, clinic_id)
  and private.appointment_matches_clinic_patient(appointment_id, clinic_id, patient_id)
  and private.staff_matches_clinic(assigned_by, clinic_id)
);

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
  v_clinic_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'escalated', 'no_show') then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.service_appointments
  where id = p_appointment_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
    return false;
  end if;

  update public.service_appointments
  set status = p_status,
      updated_at = now()
  where id = p_appointment_id;

  return found;
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
  v_clinic_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('pending', 'in_review', 'approved', 'rejected', 'expired') then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.pre_auth_requests
  where id = p_pre_auth_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
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
  where id = p_pre_auth_id;

  return found;
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
  v_clinic_id uuid;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null or btrim(coalesce(p_body, '')) = '' then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_conversations
  where id = p_conversation_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_clinic_id
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
    v_clinic_id,
    'out',
    btrim(p_body),
    'hoy ' || to_char(now(), 'HH24:MI'),
    v_staff_id
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
  v_clinic_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if p_status not in ('bot', 'waiting_human', 'in_progress', 'resolved', 'escalated') then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_conversations
  where id = p_conversation_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
    return false;
  end if;

  if p_assigned_to is not null and not private.staff_matches_clinic(p_assigned_to, v_clinic_id) then
    return false;
  end if;

  update public.clinic_conversations
  set status = p_status,
      assigned_to = p_assigned_to,
      updated_at = now()
  where id = p_conversation_id;

  return found;
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
  v_clinic_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_conversations
  where id = p_conversation_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
    return false;
  end if;

  update public.clinic_conversations
  set unread_count = 0,
      updated_at = now()
  where id = p_conversation_id;

  return found;
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
  v_appointment_clinic_id uuid;
  v_patient_id text;
  v_staff_id uuid;
  v_expected_minutes int := coalesce(p_expected_end_minutes, 60);
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

  select clinic_id, patient_id
  into v_appointment_clinic_id, v_patient_id
  from public.service_appointments
  where id = p_appointment_id;

  if v_resource_clinic_id is null
    or v_appointment_clinic_id is null
    or v_resource_clinic_id <> v_appointment_clinic_id
    or not private.is_clinic_staff_for(v_resource_clinic_id) then
    return false;
  end if;

  if not private.clinic_patient_matches_clinic(v_patient_id, v_resource_clinic_id) then
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

  update public.clinic_resource_assignments
  set status = 'freed',
      ended_at = now(),
      assigned_by = coalesce(assigned_by, v_staff_id)
  where resource_id = p_resource_id
    and status = 'active';

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
    v_patient_id,
    now() + make_interval(mins => v_expected_minutes),
    v_staff_id,
    true
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
  v_clinic_id uuid;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select clinic_id into v_clinic_id
  from public.clinic_resource_assignments
  where id = p_assignment_id;

  if v_clinic_id is null or not private.is_clinic_staff_for(v_clinic_id) then
    return false;
  end if;

  select id into v_staff_id
  from public.clinic_staff
  where user_id = (select auth.uid())
    and clinic_id = v_clinic_id
    and active = true
  order by created_at
  limit 1;

  update public.clinic_resource_assignments
  set status = 'freed',
      ended_at = now(),
      assigned_by = coalesce(assigned_by, v_staff_id)
  where id = p_assignment_id
    and status = 'active';

  return found;
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
