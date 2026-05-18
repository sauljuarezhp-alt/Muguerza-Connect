-- ============================================================================
-- Muguerza Connect — Schema demo (Supabase)
-- Pegar en SQL Editor del proyecto: https://supabase.com/dashboard/project/egehyxbtxjnlkwvlndgr/sql
-- ============================================================================

-- Limpieza (solo para re-aplicar en dev; comenta si ya hay datos en prod)
drop table if exists public.chat_messages cascade;
drop table if exists public.inbox_items   cascade;
drop table if exists public.alerts        cascade;
drop table if exists public.labs          cascade;
drop table if exists public.agenda_slots  cascade;
drop table if exists public.pending_items cascade;
drop table if exists public.patients      cascade;
drop table if exists public.doctors       cascade;

-- ---------------------------------------------------------------------------
-- DOCTORS
-- ---------------------------------------------------------------------------
create table public.doctors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  specialty    text not null,
  initials     text,
  location     text,
  consultorio  text,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- PATIENTS
-- ---------------------------------------------------------------------------
create table public.patients (
  id            text primary key,                 -- 'p1', 'p2', ...
  name          text not null,
  age           int  not null,
  sex           text check (sex in ('F','M')),
  expediente    text unique,
  dx            text,
  insurer       text,
  policy        text,
  status        text check (status in ('red','amber','green')),
  status_label  text,
  last_visit    text,
  next_visit    text,
  hospitalized  boolean default false,
  meds          text[] default '{}',
  allergies     text[] default '{}',
  vitals        jsonb,                            -- { hr, bp, temp, spo2 }
  auth_status   text check (auth_status in ('approved','pending')),
  auth_step     int,
  doctor_id     uuid references public.doctors(id) on delete set null,
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- AGENDA
-- ---------------------------------------------------------------------------
create table public.agenda_slots (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete cascade,
  tm          text not null,                     -- '08:30'
  day         text,                              -- 'Hoy'
  name        text,                              -- snapshot del nombre
  why         text,
  status      text check (status in ('checked','waiting','upcoming')),
  date        date default current_date,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- ALERTS
-- ---------------------------------------------------------------------------
create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete cascade,
  sev         text check (sev in ('red','amber','green')),
  time        text,
  patient     text,
  event       text,
  nurse       text,
  tag         text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- LABS
-- ---------------------------------------------------------------------------
create table public.labs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete cascade,
  n           text not null,                     -- 'Hemoglobina'
  unit        text,
  val         text,
  prev        text,
  range_      text,                              -- 'range' es palabra reservada
  delta       text,
  st          text check (st in ('hi','lo','ok')),
  dir         text check (dir in ('up','down','flat')),
  pdf_path    text,                              -- path en Storage
  taken_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- INBOX
-- ---------------------------------------------------------------------------
create table public.inbox_items (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete set null,
  src         text check (src in ('enfermería','paciente','aseguradora','resultados')),
  sev         text check (sev in ('red','amber','green')),
  time        text,
  subject     text,
  preview     text,
  patient     text,                              -- snapshot
  read        boolean default false,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- CHAT
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  patient_id  text references public.patients(id) on delete cascade,
  channel     text check (channel in ('nurse','patient')),
  t           text check (t in ('in','out')),
  tm          text,                              -- 'hoy 03:11'
  body        text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- PENDING
-- ---------------------------------------------------------------------------
create table public.pending_items (
  id          uuid primary key default gen_random_uuid(),
  ico         text,                              -- 'signature' | 'shield' | 'pill'
  label       text,
  sub         text,
  badge       text,
  to_screen   text,
  patient_id  text references public.patients(id) on delete set null,
  created_at  timestamptz default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Para el demo: política abierta de lectura. En prod se reemplaza por
-- policies basadas en `auth.uid() = doctor_id`.
-- ============================================================================
alter table public.doctors        enable row level security;
alter table public.patients       enable row level security;
alter table public.agenda_slots   enable row level security;
alter table public.alerts         enable row level security;
alter table public.labs           enable row level security;
alter table public.inbox_items    enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.pending_items  enable row level security;

-- Policies abiertas para el demo (solo lectura/escritura con anon key)
do $$
declare t text;
begin
  for t in select unnest(array[
    'doctors','patients','agenda_slots','alerts','labs',
    'inbox_items','chat_messages','pending_items'
  ])
  loop
    execute format('drop policy if exists "demo_read"  on public.%I;', t);
    execute format('drop policy if exists "demo_write" on public.%I;', t);
    execute format('create policy "demo_read"  on public.%I for select using (true);',  t);
    execute format('create policy "demo_write" on public.%I for all    using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('estudios', 'estudios', false),
  ('polizas',  'polizas',  false)
on conflict (id) do nothing;

-- ============================================================================
-- PORTAL SECRETARIA + DOCUMENTOS + EXTRACCION DE LABS
-- Esta seccion completa las tablas/columnas que usa el front actual.
-- Es idempotente para poder correrla sobre una DB demo existente.
-- ============================================================================

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

create index if not exists patient_history_patient_idx
  on public.patient_history(patient_id, created_at desc);

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
