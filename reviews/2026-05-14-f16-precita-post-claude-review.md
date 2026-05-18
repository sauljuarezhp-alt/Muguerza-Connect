# F-16 pre-cita post-Claude review

Fecha: 2026-05-14
Feature: F-16, pre-cita del paciente
Estado: MVP implementado, validado y desbloqueado despues de hotfix DB.

## Estado revisado

Archivos creados:

- `src/api/precita.ts`
- `src/components/PrecitaForm.tsx`
- `src/components/PrecitaSummaryCard.tsx`

Archivos modificados:

- `src/App.tsx`
- `src/components/SecretaryDesktop.tsx`
- `src/components/DesktopPatient.tsx`
- `src/api/index.ts`
- `FUTURAS_IMPLEMENTACIONES.md`

Supabase:

- No se cambio el schema funcional de F-16 durante la implementacion UI.
- Codex aplico hotfix `fix_precita_generate_token_expires_at_ambiguity` sobre `private.generate_precita_token`.
- El hotfix mantiene el contrato publico: `generate_precita_token(p_agenda_slot_id uuid, p_expires_in_hours integer default 24) returns table(token text, expires_at timestamptz)`.

## Como funciona actualmente

Secretaria o doctor autenticado:

1. En agenda, una cita `upcoming` o `waiting` con paciente muestra boton `Pre-cita`.
2. El boton llama `generatePrecitaToken`, wrapper de RPC `generate_precita_token`.
3. La DB valida que el usuario sea doctor de la cita o secretaria vinculada.
4. La DB expira tokens activos previos de esa cita.
5. La DB crea un nuevo registro en `precita_tokens` guardando solo `token_hash`.
6. El token real se devuelve una sola vez al frontend.
7. El frontend arma `/precita/:token` y copia mensaje para WhatsApp.

Paciente anonimo:

1. Abre `/precita/:token`.
2. `App.tsx` intercepta la ruta publica antes del flujo de auth.
3. `PrecitaForm` llama solo `get_precita_by_token`.
4. Si el estado es `open`, muestra formulario mobile-first.
5. Al enviar, llama `submit_precita`.
6. La DB guarda respuestas en `payload`, marca `submitted_at` y bloquea reenvios.

Doctor/secretaria autenticado:

1. En expediente, `PrecitaSummaryCard` busca la pre-cita enviada mas reciente del paciente.
2. Muestra solo campos conocidos del payload.
3. Ignora `submitted_from`, agregado por Supabase.

## Datos y contratos

Ruta publica:

- No consulta `precita_tokens` directamente.
- Solo usa RPCs publicas controladas:
  - `get_precita_by_token`
  - `submit_precita`

Portal autenticado:

- Puede consultar `precita_tokens` directamente con RLS real para:
  - status por slot en agenda.
  - ultima pre-cita enviada por paciente en expediente.

Payload MVP:

- `version`
- `chief_complaint`
- `symptoms`
- `symptom_started_at`
- `severity`
- `current_medications`
- `allergies`
- `relevant_history`
- `additional_notes`

## Validacion hecha

Local:

- `npx.cmd tsc -b` paso sin errores.

Supabase:

- `private.generate_precita_token` inspeccionada.
- Error real encontrado: `column reference "expires_at" is ambiguous`.
- Hotfix aplicado renombrando variable local a `v_expires_at` y calificando columnas.
- Validado con rollback:
  - secretaria autenticada genera token de 64 caracteres.
  - doctor autenticado genera token de 64 caracteres.
  - `anon` no puede ejecutar `generate_precita_token`.
  - no quedaron tokens de prueba.
- Advisor Security sigue sin warnings nuevos; solo queda `auth_leaked_password_protection`.

## Riesgos MVP

- El resumen del expediente muestra la ultima pre-cita enviada del paciente, no necesariamente la asociada a la cita visible en contexto.
- No hay historial visual de pre-citas anteriores.
- El link `/precita/:token` necesita despliegue web publico para pacientes reales; en local solo sirve para pruebas.
- El mensaje de WhatsApp se copia, pero no hay integracion formal con WhatsApp Business API.
- Si varias secretarias generan links para la misma cita, el token anterior se expira. Esto es correcto, pero la UI podria explicar mejor que solo el ultimo link sirve.
- No hay auditoria visible en UI sobre quien genero el link ni cuando fue enviado.

## Cambios para version final

Arquitectura:

- Mostrar pre-cita por `agenda_slot_id` cuando el usuario abre una cita especifica.
- Agregar historial de pre-citas del paciente con fecha, cita, doctor y estado.
- Separar claramente "pre-cita actual" vs "pre-citas anteriores".
- Considerar una vista de revision antes de consulta, ligada a agenda y no solo al expediente general.

UX:

- Mostrar estado de pre-cita en agenda con acciones:
  - generar link
  - reenviar/copiar link vigente
  - expirar link manualmente
  - ver respuesta
- Mostrar al doctor un indicador de "pre-cita pendiente" o "recibida" en la siguiente consulta.
- Mejorar copy cuando el link ya fue reemplazado por otro mas nuevo.

Seguridad y privacidad:

- Mantener la ruta publica limitada a RPCs.
- No exponer expediente, labs, documentos, aseguradora ni historial por token.
- Evaluar expiracion segun politica clinica real: 24h puede ser poco o mucho dependiendo del flujo.
- Agregar auditoria de generacion/envio si se vuelve flujo productivo.

Operaciones:

- Definir dominio publico y variable base URL para links de paciente.
- Agregar monitoreo de errores RPC para tokens invalidos, expirados o submits fallidos.
- Preparar pruebas end-to-end para flujo secretaria -> paciente -> doctor.

## Decision

Listo para seguir como MVP.

No bloquea continuar con siguientes features, pero antes de produccion conviene ligar el resumen a cita especifica y agregar historial de pre-citas para evitar confusion clinica.

