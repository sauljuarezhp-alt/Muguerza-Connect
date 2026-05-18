# Patient history structured links DB review

Fecha: 2026-05-14
Area: Historial clinico por paciente, F-16 pre-cita, eventos ligados a fuentes reales
Estado: Base de datos lista; UI inicial de historial estructurado aplicada y validada.

## Problema detectado

`patient_history` funcionaba como bitacora MVP, pero solo tenia:

- `id`
- `patient_id`
- `type`
- `title`
- `description`
- `icon`
- `created_at`

Eso permitia ver que algo habia pasado, pero no consultar de forma robusta que lo produjo.

Ejemplos del problema:

- Una fila "Consulta atendida" no sabia cual `consultations.id` ni cual `agenda_slot_id` la originaron.
- Una pre-cita enviada se veia en el expediente solo como "ultima pre-cita del paciente", no ligada a una cita concreta.
- Un documento/lab/orden podia verse visualmente, pero el historial no tenia `document_id`, `lab_id` ni `source_id`.

## Migraciones aplicadas

- `patient_history_structured_event_links`
- `fix_patient_history_occurred_at_backfill`
- `harden_patient_history_structured_insert_policy`

## Columnas agregadas a `patient_history`

- `doctor_id uuid`
- `agenda_slot_id uuid`
- `consultation_id uuid`
- `precita_token_id uuid`
- `document_id uuid`
- `lab_id uuid`
- `source_table text`
- `source_id uuid`
- `event_type text`
- `occurred_at timestamptz`
- `metadata jsonb`
- `created_by uuid`

Los campos MVP siguen existiendo para compatibilidad:

- `type`
- `title`
- `description`
- `icon`
- `created_at`

## Indices agregados

- `patient_history_patient_occurred_idx`
- `patient_history_doctor_occurred_idx`
- `patient_history_agenda_slot_idx`
- `patient_history_consultation_idx`
- `patient_history_precita_idx`
- `patient_history_document_idx`
- `patient_history_lab_idx`
- `patient_history_event_type_idx`
- `patient_history_unique_event_source_idx`

La unicidad por fuente es:

```text
(event_type, source_table, source_id)
```

Esto evita duplicar el mismo evento fuente, pero permite varios eventos sobre la misma entidad si tienen distinto `event_type`.

## Funcion privada nueva

`private.record_patient_history_event(...)`

Uso:

- Funciones privadas pueden registrar eventos estructurados sin exponer permisos globales.
- `anon` y `authenticated` no tienen execute directo.
- Inserta o actualiza por `(event_type, source_table, source_id)`.

## F-16 actualizado en DB

`private.submit_precita` ahora:

1. Valida token.
2. Bloquea reenvio si ya fue enviado.
3. Guarda `payload` y `submitted_at`.
4. Crea evento en `patient_history`:
   - `type = 'precita'`
   - `event_type = 'precita_submitted'`
   - `source_table = 'precita_tokens'`
   - `source_id = precita_tokens.id`
   - `agenda_slot_id = precita_tokens.agenda_slot_id`
   - `precita_token_id = precita_tokens.id`
   - `doctor_id = precita_tokens.doctor_id`
   - `occurred_at = submitted_at`

## Backfill aplicado

Quedaron ligados cuando la fuente era identificable:

- `document_uploaded` desde `patient_documents`
- `consultation_closed` desde `consultations`
- `lab_result_recorded` desde `labs`
- `precita_submitted` desde `precita_tokens`

Algunos eventos legacy quedaron sin `event_type/source_id` porque no hay forma confiable de saber su fuente original.

## Seguridad validada

- `anon` no tiene `select`, `insert`, `update` ni `delete` sobre `patient_history`.
- `authenticated` conserva `select` e `insert`; no tiene `update` ni `delete`.
- INSERT ahora valida:
  - el paciente debe ser accesible por RLS real.
  - `doctor_id`, si viene, debe ser accesible.
  - `agenda_slot_id`, `consultation_id`, `precita_token_id`, `document_id` y `lab_id`, si vienen, deben pertenecer al mismo `patient_id`.
- Prueba rollback valida: insert estructurado correcto funciona.
- Prueba negativa valida: intento de ligar paciente A con documento de paciente B falla por RLS.
- `private.record_patient_history_event` no es ejecutable por `anon` ni `authenticated`.
- Advisor Security no agrego warnings nuevos; sigue solo `auth_leaked_password_protection`.

## Validacion funcional

Rollback de `submit_precita`:

- Generar token como secretaria.
- Enviar payload publico.
- Confirmar `success=true`, `status='submitted'`.
- Confirmar que se crea evento `precita_submitted` ligado a `agenda_slot_id` y `precita_token_id`.
- Rollback deja la base sin datos de prueba.

Conteo visible para doctor/secretaria vinculados:

- 13 eventos visibles actuales.
- 3 ligados a `agenda_slot_id`.
- 2 ligados a `consultation_id`.
- 1 ligado a `precita_token_id`.
- 3 ligados a `document_id`.
- 2 ligados a `lab_id`.

## UI/API local aplicada despues

La UI/API local ya consume historial estructurado en la primera capa funcional:

- `listHistory` ordena por `occurred_at` con fallback a `created_at`.
- El tab Historial muestra eventos por `event_type` cuando existe y mantiene compatibilidad con registros legacy sin `event_type`.
- Cada evento del historial se puede abrir inline para ver metadatos y ligas fuente.
- La pre-cita se consulta por `agenda_slot_id` para mostrar respuestas por cita especifica.
- La ruta publica `/precita/:token` sigue limitada a RPCs publicas.
- Validacion local: `npx.cmd tsc -b` pasa sin errores.

## Pendientes para version final

- Hacer que cierre de consulta deje de insertar historial viejo sin source desde frontend, o actualizarlo para usar los nuevos campos.
- Hacer que subida de documento y labs manuales inserten historial estructurado desde el cliente si no se mueven a RPCs privadas.
- Considerar triggers/RPCs para eventos criticos si se quiere que toda la auditoria viva en DB y no dependa del frontend.
- Agregar UI para filtrar historial por cita, tipo de evento y fuente.
- Agregar pantalla de "timeline por cita" con pre-cita, documentos, labs, cierre, ordenes y mensajes relacionados.
