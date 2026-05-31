-- Cover clinic_patients foreign keys added to existing clinic tables.

create index if not exists clinic_conversations_patient_id_idx
  on public.clinic_conversations (patient_id);

create index if not exists clinic_resource_assignments_patient_id_idx
  on public.clinic_resource_assignments (patient_id);

create index if not exists pre_auth_requests_patient_id_idx
  on public.pre_auth_requests (patient_id);

create index if not exists service_results_patient_id_idx
  on public.service_results (patient_id);
