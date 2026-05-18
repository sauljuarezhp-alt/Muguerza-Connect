# Review: Legacy Data Cleanup

Fecha: 2026-05-14
Area: datos legacy, historial por paciente, agenda, documentos, Storage
Estado: Limpieza/adaptacion aplicada y validada.

## Objetivo

Detectar datos creados durante pruebas tempranas de Muguerza Connect que ya no encajaban con la arquitectura actual y decidir:

- adaptarlos si habia fuente confiable,
- no inventar datos clinicos,
- no borrar informacion util sin evidencia.

## Migraciones aplicadas

- `adapt_legacy_floating_mvp_data_v2`
- `allow_cancelled_agenda_slots_and_close_legacy_past_slots`
- `restore_local_today_slots_after_legacy_cleanup`

## Datos adaptados

### Agenda

- Se detecto un slot antiguo de Carlos Herrera sin `patient_id`.
- Se ligo al paciente correcto porque coincidian:
  - nombre,
  - doctor,
  - paciente unico.
- Se corrigio el constraint `agenda_slots_status_check` para admitir `cancelled`, estado que el frontend ya contemplaba.
- Las citas pasadas anteriores al 14 de mayo de 2026 local que seguian `upcoming/waiting` fueron marcadas `cancelled` con razon:
  - `Legacy cleanup: past unresolved slot, not marked as attended`
- No se crearon consultas ni ingresos falsos.
- La cita de Carlos Herrera del 14 de mayo de 2026 a las 13:00 fue restaurada a `upcoming` porque es fecha local actual, no legacy pasado.

### Historial

- Antes habia 5 eventos sin `event_type`.
- Ahora todos tienen estructura:
  - `legacy_consultation_note`: 2
  - `legacy_order_note`: 3
- Los eventos legacy conservan:
  - titulo original,
  - descripcion original,
  - icono original,
  - `source_table = 'patient_history'`,
  - `source_id = patient_history.id`,
  - `metadata.legacy_mvp_record = true`.
- Las consultas legacy se ligaron a `agenda_slot_id` cuando habia match por paciente, hora y motivo.

### Documentos y Storage

- Se detecto 1 objeto huérfano en Storage:
  - bucket `estudios`
  - ruta de Carlos Herrera
- Se recupero como fila real en `patient_documents`.
- Se agrego evento `document_uploaded` ligado a esa fila.
- Se limpiaron URLs publicas persistidas en `patient_documents.url`.

## Rutas corregidas para no crear mas legacy

Archivos modificados:

- `src/api/secretary.ts`
- `src/api/consultationTypes.ts`
- `src/api/pending.ts`
- `src/components/DesktopPatient.tsx`
- `supabase/functions/extract-labs/index.ts`

Cambios:

- `uploadPatientDocument` ahora inserta historial `document_uploaded` con `document_id`, `source_table`, `source_id`, `event_type`, `occurred_at` y `metadata`.
- `closeConsultationFromSlot` ahora inserta historial `consultation_closed` con `agenda_slot_id`, `consultation_id`, `source_table`, `source_id` y metadata de pago.
- `resolvePendingItem` ya no crea historial sin `event_type`; usa `legacy_order_note` ligado al `pending_item`.
- `extract-labs` desplegada version 7 con historial `lab_extraction_summary` ligado a labs.
- `DesktopPatient` reconoce badges para:
  - `legacy_consultation_note`
  - `legacy_order_note`
  - `legacy_history_note`
  - `lab_extraction_summary`

## Validacion

Checks en cero:

- `agenda_slots_without_patient`
- `past_unresolved_slots_mx_local`
- `history_legacy_no_event_type`
- `documents_with_legacy_public_url`
- `storage_orphan_objects`
- `history_source_missing`

Validacion adicional:

- `npx.cmd tsc -b` pasa sin errores.
- Advisor Security solo conserva `auth_leaked_password_protection`.
- `extract-labs` quedo activa con `verify_jwt = true`.

## Pendientes

- No se borraron datos clinicos.
- Si se quiere purga completa de pruebas demo, hay que definir una regla de negocio: borrar por paciente demo, por fecha o por etiqueta. Sin esa regla, la decision segura es conservar adaptado.
