-- Mini Plan 1: clinic_patients identity separation for the ambulatory clinic module.
-- The private-office patients table remains outside this module.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = private, public, auth
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clinic_patients (
  id text primary key,
  clinic_id uuid not null references public.clinics(id),
  full_name text not null,
  phone text null,
  email text null,
  sex text null check (sex in ('F', 'M', 'O', 'unknown')),
  date_of_birth date null,
  external_patient_ref text null,
  insurer text null,
  policy_number text null,
  emergency_contact jsonb not null default '{}'::jsonb,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_patients_full_name_not_blank check (btrim(full_name) <> ''),
  constraint clinic_patients_id_not_blank check (btrim(id) <> '')
);

create unique index if not exists clinic_patients_clinic_external_ref_unique
  on public.clinic_patients (clinic_id, external_patient_ref)
  where external_patient_ref is not null;

create index if not exists clinic_patients_clinic_idx
  on public.clinic_patients (clinic_id);

create index if not exists clinic_patients_clinic_active_idx
  on public.clinic_patients (clinic_id, active);

create index if not exists clinic_patients_full_name_idx
  on public.clinic_patients (full_name);

create index if not exists clinic_patients_phone_idx
  on public.clinic_patients (phone)
  where phone is not null;

create index if not exists clinic_patients_insurer_idx
  on public.clinic_patients (insurer)
  where insurer is not null;

drop trigger if exists clinic_patients_set_updated_at on public.clinic_patients;
create trigger clinic_patients_set_updated_at
before update on public.clinic_patients
for each row
execute function private.set_updated_at();

with patient_source as (
  select clinic_id, patient_id, null::text as patient_name, null::text as patient_phone, insurer
  from public.service_appointments
  union all
  select clinic_id, patient_id, null::text, null::text, insurer
  from public.pre_auth_requests
  union all
  select clinic_id, patient_id, null::text, null::text, null::text
  from public.service_results
  union all
  select clinic_id, patient_id, patient_name, patient_phone, null::text
  from public.clinic_conversations
  union all
  select clinic_id, patient_id, null::text, null::text, null::text
  from public.clinic_resource_assignments
),
patient_rollup as (
  select
    clinic_id,
    patient_id,
    coalesce(
      max(patient_name) filter (where patient_name is not null and btrim(patient_name) <> ''),
      'Paciente ' || patient_id
    ) as full_name,
    max(patient_phone) filter (where patient_phone is not null and btrim(patient_phone) <> '') as phone,
    max(insurer) filter (where insurer is not null and btrim(insurer) <> '') as insurer
  from patient_source
  where patient_id is not null and btrim(patient_id) <> ''
  group by clinic_id, patient_id
)
insert into public.clinic_patients (
  id,
  clinic_id,
  full_name,
  phone,
  insurer,
  external_patient_ref,
  notes
)
select
  patient_id,
  clinic_id,
  full_name,
  phone,
  insurer,
  patient_id,
  case
    when full_name = 'Paciente ' || patient_id
      then 'Backfill demo: nombre real pendiente de depurar en modulo clinicas.'
    else null
  end
from patient_rollup
on conflict (id) do update
set
  clinic_id = excluded.clinic_id,
  full_name = excluded.full_name,
  phone = coalesce(public.clinic_patients.phone, excluded.phone),
  insurer = coalesce(public.clinic_patients.insurer, excluded.insurer),
  external_patient_ref = coalesce(public.clinic_patients.external_patient_ref, excluded.external_patient_ref),
  notes = coalesce(public.clinic_patients.notes, excluded.notes),
  updated_at = now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_appointments_patient_id_clinic_patients_fkey'
  ) then
    alter table public.service_appointments
      add constraint service_appointments_patient_id_clinic_patients_fkey
      foreign key (patient_id) references public.clinic_patients(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pre_auth_requests_patient_id_clinic_patients_fkey'
  ) then
    alter table public.pre_auth_requests
      add constraint pre_auth_requests_patient_id_clinic_patients_fkey
      foreign key (patient_id) references public.clinic_patients(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_results_patient_id_clinic_patients_fkey'
  ) then
    alter table public.service_results
      add constraint service_results_patient_id_clinic_patients_fkey
      foreign key (patient_id) references public.clinic_patients(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_conversations_patient_id_clinic_patients_fkey'
  ) then
    alter table public.clinic_conversations
      add constraint clinic_conversations_patient_id_clinic_patients_fkey
      foreign key (patient_id) references public.clinic_patients(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinic_resource_assignments_patient_id_clinic_patients_fkey'
  ) then
    alter table public.clinic_resource_assignments
      add constraint clinic_resource_assignments_patient_id_clinic_patients_fkey
      foreign key (patient_id) references public.clinic_patients(id);
  end if;
end;
$$;

alter table public.clinic_patients enable row level security;

revoke all on table public.clinic_patients from anon;
revoke all on table public.clinic_patients from authenticated;
grant select, insert, update on table public.clinic_patients to authenticated;

drop policy if exists clinic_staff_select_clinic_patients on public.clinic_patients;
create policy clinic_staff_select_clinic_patients
on public.clinic_patients
for select
to authenticated
using (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_staff_insert_clinic_patients on public.clinic_patients;
create policy clinic_staff_insert_clinic_patients
on public.clinic_patients
for insert
to authenticated
with check (private.is_clinic_staff_for(clinic_id));

drop policy if exists clinic_staff_update_clinic_patients on public.clinic_patients;
create policy clinic_staff_update_clinic_patients
on public.clinic_patients
for update
to authenticated
using (private.is_clinic_staff_for(clinic_id))
with check (private.is_clinic_staff_for(clinic_id));
