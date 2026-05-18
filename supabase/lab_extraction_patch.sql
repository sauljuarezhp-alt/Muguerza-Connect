-- Muguerza Connect - patch no destructivo para documentos + extraccion de labs.
-- Ejecutar en Supabase SQL Editor sobre la base actual. No borra datos.

alter table public.doctors
  add column if not exists user_id uuid unique;

alter table public.patients
  add column if not exists auth_note text,
  add column if not exists deducible text,
  add column if not exists coaseguro text,
  add column if not exists vigencia_poliza text,
  add column if not exists vitals_recorded_at timestamptz;

alter table public.agenda_slots
  add column if not exists doctor_id uuid references public.doctors(id) on delete cascade,
  add column if not exists cancel_reason text;

create table if not exists public.secretaries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text unique,
  user_id    uuid unique,
  created_at timestamptz default now()
);

create table if not exists public.secretary_doctors (
  secretary_id uuid references public.secretaries(id) on delete cascade,
  doctor_id    uuid references public.doctors(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (secretary_id, doctor_id)
);

create table if not exists public.patient_documents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   text references public.patients(id) on delete cascade,
  name         text not null,
  type         text not null,
  url          text,
  bucket       text check (bucket in ('estudios','polizas')),
  storage_path text,
  uploaded_at  timestamptz default now()
);

alter table public.patient_documents
  add column if not exists patient_id text references public.patients(id) on delete cascade,
  add column if not exists name text,
  add column if not exists type text,
  add column if not exists url text,
  add column if not exists bucket text check (bucket in ('estudios','polizas')),
  add column if not exists storage_path text,
  add column if not exists uploaded_at timestamptz default now();

create index if not exists patient_documents_patient_idx
  on public.patient_documents(patient_id, uploaded_at desc);

create table if not exists public.patient_history (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete cascade,
  type        text check (type in ('cita','orden','documento')),
  title       text not null,
  description text,
  icon        text,
  created_at  timestamptz default now()
);

alter table public.patient_history
  add column if not exists patient_id text references public.patients(id) on delete cascade,
  add column if not exists type text check (type in ('cita','orden','documento')),
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists icon text,
  add column if not exists created_at timestamptz default now();

create index if not exists patient_history_patient_idx
  on public.patient_history(patient_id, created_at desc);

insert into storage.buckets (id, name, public)
values
  ('estudios', 'estudios', false),
  ('polizas',  'polizas',  false)
on conflict (id) do nothing;

alter table public.secretaries        enable row level security;
alter table public.secretary_doctors  enable row level security;
alter table public.patient_documents  enable row level security;
alter table public.patient_history    enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array[
    'secretaries','secretary_doctors','patient_documents','patient_history'
  ])
  loop
    execute format('drop policy if exists "demo_read"  on public.%I;', t);
    execute format('drop policy if exists "demo_write" on public.%I;', t);
    execute format('create policy "demo_read"  on public.%I for select using (true);',  t);
    execute format('create policy "demo_write" on public.%I for all    using (true) with check (true);', t);
  end loop;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.labs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.patient_documents;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.patient_history;
exception when duplicate_object then null;
end $$;
