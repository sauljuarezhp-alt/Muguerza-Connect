# RLS hardening phase 1, 2A, 2B and 2C handoff

Date: 2026-05-13
Project: `egehyxbtxjnlkwvlndgr`

## What was applied

Migrations:
- `role_based_rls_phase1_identity_f14_f16`
- `role_based_rls_phase2a_patients_agenda`
- `role_based_rls_phase2b_clinical_records`
- `role_based_rls_phase2c_operational_tables`

Scope was intentionally limited after a broad all-table rewrite was rejected as too risky for one production migration.

Phase 1 covers:
- `doctors`
- `secretaries`
- `secretary_doctors`
- `consultations`
- `doctor_consultation_types`
- `precita_tokens`
- `doctor_metrics_monthly`
- `specialty_benchmarks_monthly`

Phase 2A covers:
- `patients`
- `agenda_slots`

Phase 2B covers:
- `labs`
- `patient_documents`
- `patient_history`

Phase 2C covers:
- `alerts`
- `inbox_items`
- `chat_messages`
- `pending_items`

Private helpers created:
- `private.current_doctor_id()`
- `private.current_secretary_id()`
- `private.is_doctor_owner(p_doctor_id uuid)`
- `private.is_secretary_for_doctor(p_doctor_id uuid)`
- `private.can_access_doctor(p_doctor_id uuid)`
- `private.can_access_patient(p_patient_id text)`

The helpers are `SECURITY DEFINER`, live in the unexposed `private` schema, and are used by policies to avoid recursive RLS issues. Execute was granted to `authenticated` and revoked from `anon`/`public` for these helper functions.

## Access model now enforced

- Doctors can read/update their own doctor profile.
- Doctors can search secretaries for team linking.
- Secretaries can read/update their own secretary profile.
- Doctors can manage `secretary_doctors` links for their own doctor record.
- Secretaries can read their own doctor links.
- Doctors and linked secretaries can read/insert/update `consultations` for accessible doctors.
- Doctors and linked secretaries can read `doctor_consultation_types`; only doctor owners can insert/update types.
- Doctors and linked secretaries can read direct `precita_tokens` rows; `anon` has no direct table access.
- Doctors and linked secretaries can read, create, and update accessible `patients`; direct patient delete is not granted.
- Doctors and linked secretaries can read, create, update, and delete accessible `agenda_slots`.
- Doctors and linked secretaries can read, create, and update accessible `labs`; direct lab delete is not granted.
- Doctors and linked secretaries can read, upload, and delete accessible `patient_documents`; direct document update is not granted.
- Doctors and linked secretaries can read and add accessible `patient_history`; direct history update/delete is not granted.
- Doctors and linked secretaries can read accessible `alerts`; direct alert writes are not granted to the portal.
- Doctors and linked secretaries can read/update accessible `inbox_items`.
- Doctors and linked secretaries can read/send accessible `chat_messages`; direct chat update/delete is not granted.
- Doctors and linked secretaries can read/create/delete accessible `pending_items`; new portal-created pending items must be tied to an accessible patient.
- `anon` no longer has direct table/view access to the phase 1 objects.
- `anon` no longer has direct table access to `patients` or `agenda_slots`.
- `anon` no longer has direct table access to `labs`, `patient_documents`, or `patient_history`.
- `anon` no longer has direct table access to `alerts`, `inbox_items`, `chat_messages`, or `pending_items`.
- F-16 public RPC grants remain unchanged:
  - `generate_precita_token`: `authenticated`
  - `get_precita_by_token`: `anon`, `authenticated`
  - `submit_precita`: `anon`, `authenticated`

## Validation performed

Doctor simulated with `request.jwt.claim.sub = 893bef56-5b33-47bf-be92-b768d53bb15d`:
- `doctors`: 1 row
- `secretaries`: 1 row
- `secretary_doctors`: 1 row
- `consultations`: 2 rows
- `doctor_consultation_types`: 3 rows
- `doctor_metrics_monthly`: 1 row
- `specialty_benchmarks_monthly`: 1 row
- `precita_tokens`: 0 rows
- After phase 2A, `patients`: 4 rows
- After phase 2A, `agenda_slots` on `2026-05-13`: 4 rows
- After phase 2B, `labs`: 2 rows
- After phase 2B, `patient_documents`: 3 rows
- After phase 2B, `patient_history`: 8 rows
- After phase 2C, operational tables are readable and currently have 0 rows: `alerts`, `inbox_items`, `chat_messages`, `pending_items`.
- Write checks in rollback passed for doctor inserting `chat_messages` and `pending_items` for an accessible patient.

Secretary simulated with `request.jwt.claim.sub = 18ce90b6-398b-44f2-ac2f-c43ac4b37498`:
- same expected counts as doctor for the linked doctor.
- After phase 2A, same expected `patients` and `agenda_slots` counts as doctor for the linked doctor.
- After phase 2B, same expected `labs`, `patient_documents`, and `patient_history` counts as doctor for the linked doctor.
- Write checks in rollback passed for secretary inserting a lab, document metadata, and history event for an accessible patient.
- After phase 2C, operational tables are readable and currently have 0 rows: `alerts`, `inbox_items`, `chat_messages`, `pending_items`.
- Write checks in rollback passed for secretary inserting `chat_messages` and `pending_items` for an accessible patient.

Anon privilege check:
- `select`, `insert`, `update`, `delete` are false for all phase 1 tables/views.
- `select`, `insert`, `update`, `delete` are false for `patients` and `agenda_slots`.
- `select`, `insert`, `update`, `delete` are false for `labs`, `patient_documents`, and `patient_history`.
- `select`, `insert`, `update`, `delete` are false for `alerts`, `inbox_items`, `chat_messages`, and `pending_items`.

Data correction:
- The Carlos Herrera appointment at `18:30` had been saved as `2026-05-14` because the frontend used UTC via `toISOString()`.
- It was corrected to `day = 2026-05-13` and `date = 2026-05-13`.
- The frontend now uses local date formatting via `src/lib/dates.ts`.

Advisor Security after phase 2C:
- No `security_definer_view` errors for F-14 views.
- No `demo_write` warnings remain for phase 1 tables.
- No `demo_write` warnings remain for `patients` or `agenda_slots`.
- No `demo_write` warnings remain for `labs`, `patient_documents`, or `patient_history`.
- No `demo_write` warnings remain for `alerts`, `inbox_items`, `chat_messages`, or `pending_items`.
- Remaining security warning: Supabase Auth leaked password protection is disabled.

## Not done yet

- Supabase Auth leaked password protection.
- Performance cleanup for unindexed FKs.
- Rewriting old policies that still call `auth.uid()` directly instead of `(select auth.uid())`.
