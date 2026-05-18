# Muguerza Connect — Registro de Implementaciones y Features Pendientes

Documento vivo. Sirve como bitácora para desarrolladores e IAs que continúen el proyecto.
Cada feature implementada queda documentada con archivos, decisiones y cómo probarla.

**Convenciones de estado**
- ✅ **Implementado** — en producción/main.
- 🟢 **En sprint** — priorizado, sin iniciar o en progreso.
- 🟡 **Siguiente** — requiere algo antes de arrancar.
- 🔴 **Requiere presupuesto** — depende de API Anthropic u otro servicio de pago.

**Motores de valor**
- **M1** — Le ahorra tiempo al doctor.
- **M2** — Lo hace verse mejor frente al paciente.
- **M3** — Cierra el círculo Muguerza (referido / lock-in legítimo).

---

## ✅ F-3-lite · Pre-consulta automática

**Estado:** Implementado — mayo 2026
**Motor:** M1 + M2 · **Costo real:** $0 · **IA requerida:** No

### Qué hace
Antes de cada cita, el doctor ve en el Dashboard una barra compacta con el nombre del siguiente paciente en agenda. Al expandirla aparece un resumen con: última visita, labs fuera de rango, medicamentos activos y alertas abiertas. A los 5 minutos de la cita llega una notificación browser automática.

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/api/preconsulta.ts` | `buildPreconsulta(doctorId)` — hace 4 queries en paralelo y devuelve `PreconsultaData` |
| `src/components/PreconsultaCard.tsx` | Barra colapsable + panel expandido con grid de 4 celdas |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/api/index.ts` | Export de `preconsulta.ts` en el barrel |
| `src/components/DesktopDashboard.tsx` | Estado `preconsulta`, poll cada 60s, notificación automática a ≤5 min, render del card entre saludo y KPIs |

### Decisiones técnicas
- **Sin tabla nueva** — lee de `agenda_slots`, `patients`, `labs`, `alerts`, `agenda_slots` (cancelled). Todo ya existía.
- **Query de slots** usa `.in('status', ['upcoming', 'waiting'])` — incluye ambos porque la secretaria puede marcar "En sala" antes de que el doctor abra el dashboard.
- **Notificación una sola vez por slot** — `notifiedSlotRef` (useRef) guarda el último `slotId` notificado para evitar spam aunque el interval siga corriendo.
- **Dismiss por slot** — `currentSlotRef` detecta cuando cambia el slot y resetea el dismiss. El × oculta solo la cita actual, no las siguientes.
- **Card colapsado por default** — el doctor ve una barra de una línea ("Siguiente en agenda / nombre / hora / Ver resumen del paciente ▾"). Expande al hacer click para no ocupar espacio en el dashboard.

### Cómo probar

**Card visible:**
1. Ir al portal de la secretaria → Agenda → crear slot para hoy con status `upcoming` o `waiting` y paciente asignado.
2. Abrir el Dashboard del doctor — la barra aparece entre el saludo y los KPIs.
3. Hacer click para expandir y ver el resumen.

**Notificación automática (sin esperar):**
1. Crear un slot a `hora_actual + 4 minutos`.
2. Verificar que el browser tiene permiso de notificaciones para `localhost` (Connect lo pide solo la primera vez).
3. Esperar hasta 60 segundos — la notificación llega sola sin tocar nada.

---

## 🟢 F-2 · Re-receta inteligente + receta desde 0

**Motor:** M1 · **Costo:** $0 · **Bloqueante:** ninguno

### Qué construir
- Tabla nueva `prescriptions` en Supabase (ver esquema en plan de implementación de la sesión).
- Bucket `recetas` en Storage (privado, signed URLs).
- `src/api/prescriptions.ts` — `listPrescriptions`, `createPrescription`, `repeatLastPrescription`.
- `src/lib/prescriptionPdf.ts` — genera PDF con jsPDF (client-side, sin backend).
- `src/components/PrescriptionModal.tsx` — formulario con autocomplete de medicamentos.
- `src/components/PrescriptionList.tsx` — historial con "Reimprimir" y "Repetir".
- Nuevo tab "Recetas" en `DesktopPatient.tsx`.

### Dependencia a instalar
```
npm i jspdf
```

### Notas
- El banco de medicamentos va en `src/data/medicamentos.ts` (mismo patrón que `analitos.ts`).
- El folio se genera como `MUG-YYYY-NNNNN` con secuencia por año.
- PDF incluye: header Muguerza, datos del doctor (cédula, especialidad, consultorio), paciente, tabla de medicamentos, indicaciones, firma y folio.

---

## ✅ F-14+6 · Dashboard de rendimiento del doctor + storytelling de pacientes

**Estado:** Implementado y probado — mayo 2026  
**Motor:** M1 + M2 · **Costo real:** $0 · **IA requerida:** No

### Qué hace
Agrega una pantalla "Mi práctica" al portal del doctor con métricas operativas y financieras: consultas del mes, ingresos, pacientes únicos, NPS, evolución 12 meses, distribución por tipo de consulta, distribución por método de pago, comparativo anónimo por especialidad y top pacientes.

También agrega "Modo paciente" dentro del expediente, con línea de tiempo y visualización de evolución de laboratorios cuando hay suficientes muestras del mismo analito.

La parte financiera se alimenta de consultas reales cerradas por la secretaria. El doctor configura sus tipos de consulta y precios; la secretaria selecciona el tipo, monto y método de pago al marcar una cita como "Atendida".

### Supabase aplicado
Proyecto: `egehyxbtxjnlkwvlndgr`.

Tablas/vistas creadas o extendidas:
- `consultations` — fuente histórica de consultas cerradas, ingresos y métodos de pago.
- `doctor_consultation_types` — catálogo futuro de tipos de consulta/precios por doctor.
- `doctor_metrics_monthly` — vista mensual por doctor.
- `specialty_benchmarks_monthly` — vista mensual anónima por especialidad.

Columnas clave en `consultations`:
- `patient_id text` — se mantiene como `text` porque `patients.id` es `text` en la base real.
- `doctor_id uuid`.
- `agenda_slot_id uuid`.
- `type` — categoría interna: `primera_vez`, `subsecuente`, `urgencia`.
- `fee` — snapshot histórico del monto cobrado.
- `payment_method` — `efectivo`, `tarjeta`, `aseguradora`, `cortesia`.
- `insurer` — aseguradora cuando aplica.
- `consultation_type_id`.
- `consultation_type_name` — snapshot histórico del nombre visible.
- `fee_overridden` — indica si el monto final difiere del precio base.

Tabla `doctor_consultation_types`:
- `doctor_id`, `name`, `category`, `base_fee`, `min_fee`, `max_fee`, `active`, `is_custom`, `specialty_template`, `created_at`, `updated_at`.
- RLS activo.
- Doctor puede leer/insertar/actualizar sus tipos.
- Secretaria puede leer tipos de los doctores vinculados.

Índices/constraints/triggers aplicados:
- `idx_consultations_agenda_slot_unique` evita duplicar consultas para el mismo `agenda_slot_id`.
- `idx_consultations_doctor_date`, `idx_consultations_patient`, `idx_consultations_agenda_slot`, `idx_consultations_type`, `idx_consultations_type_doctor`.
- `idx_doctor_consultation_types_doctor`, `idx_doctor_consultation_types_active`, `idx_doctor_consultation_types_active_name`.
- FK compuesta `consultations_type_matches_doctor_fkey` evita usar un tipo de consulta de otro doctor.
- Trigger `apply_consultation_type_snapshot_before_write` copia `category` a `consultations.type`, llena `consultation_type_name` y calcula `fee_overridden`.
- Trigger `set_doctor_consultation_types_updated_at` mantiene `updated_at`.

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/api/metrics.ts` | Lectura de métricas, benchmark, top pacientes y desglose por método de pago |
| `src/api/consultationTypes.ts` | CRUD de tipos de consulta y `closeConsultationFromSlot` |
| `src/data/consultationTemplates.ts` | Plantillas de tipos por especialidad y labels de categoría |
| `src/components/DesktopPracticeDashboard.tsx` | Pantalla "Mi práctica" con KPIs, gráficas, comparativos y panel de precios |
| `src/components/PatientStoryView.tsx` | Vista "Modo paciente" con línea de tiempo y evolución de labs |
| `src/components/CloseConsultationModal.tsx` | Modal de cierre/cobro para secretaria |
| `src/components/ConsultationTypesPanel.tsx` | Panel del doctor para gestionar tipos y precios |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/api/index.ts` | Exports de `metrics.ts` y `consultationTypes.ts` |
| `src/data/icons.tsx` | Ícono de gráfica agregado |
| `src/components/MCDesktop.tsx` | Sidebar y ruta de "Mi práctica" |
| `src/components/DesktopPatient.tsx` | Tab "Modo paciente" |
| `src/components/SecretaryDesktop.tsx` | "Atendida" abre modal de cierre, ya no inserta `fee=0` silencioso |
| `src/components/DesktopPracticeDashboard.tsx` | Integra `ConsultationTypesPanel` |

### Cómo funciona
1. El doctor entra a "Mi práctica" y configura tipos/precios de consulta.
2. Puede usar sugerencias por especialidad o crear tipos personalizados.
3. Los tipos se desactivan con `active=false`; no se borran para preservar histórico.
4. La secretaria marca una cita pasada como "Atendida".
5. Se abre `CloseConsultationModal`.
6. La secretaria selecciona tipo de consulta, monto y método de pago.
7. Si el método es `aseguradora`, captura `insurer`.
8. `closeConsultationFromSlot` actualiza el slot a `checked`, inserta `consultations` y agrega historial.
9. El dashboard lee `consultations.fee` como cash real; no calcula ingresos desde agenda.

### Decisiones técnicas
- `consultations.fee` es el snapshot histórico de ingresos. Si el doctor cambia precios después, consultas antiguas no se recalculan.
- `consultation_type_name` guarda el nombre visible histórico.
- `doctor_consultation_types` define precios futuros, no ingresos históricos.
- `type` conserva solo la categoría interna para métricas: `primera_vez`, `subsecuente`, `urgencia`.
- `payment_method` alimenta el desglose de pagos del dashboard.
- El caso sin tipos configurados bloquea el cierre para evitar consultas ambiguas con `fee=0`.
- `fee=0` solo debe representar cortesía/intención explícita, no fallback silencioso.
- `getTopPatients` agrega en cliente porque necesita join con `patients`.
- Las gráficas de labs solo aparecen con al menos dos muestras del mismo analito.

### Validación realizada
- Typecheck/build reportado sin errores por Claude.
- Flujo doctor: configuración de tipos/precios desde "Mi práctica".
- Flujo secretaria: botón "Atendida" abre modal, captura tipo, monto, método de pago y aseguradora si aplica.
- Flujo dashboard: ingresos reales aparecen desde `consultations.fee`.
- Caso sin tipos: el modal advierte y bloquea guardado.
- Duplicados por cita: prevenidos por unique index de `agenda_slot_id`.
- Hardening Supabase aplicado por Codex el 13 de mayo de 2026:
  - `doctor_metrics_monthly` y `specialty_benchmarks_monthly` quedaron con `security_invoker=true`.
  - Advisor Security ya no reporta `security_definer_view` para esas dos vistas.
  - Lectura validada con RLS real: doctor y secretaria autenticados ven sus métricas; `anon` ve 0 filas.
  - No se abrieron grants ni policies globales adicionales.
- Limpieza F-14 revisada el 13 de mayo de 2026: `insertConsultation` ya no existe en `src/api/metrics.ts` ni en el código de aplicación.
- RLS por rol de app, fase 1 aplicada por Codex el 13 de mayo de 2026:
  - Se crearon helpers privados `private.current_doctor_id`, `private.current_secretary_id`, `private.is_doctor_owner`, `private.is_secretary_for_doctor` y `private.can_access_doctor`.
  - Se reemplazaron las policies demo/permisivas en `doctors`, `secretaries` y `secretary_doctors` por policies `to authenticated` basadas en doctor dueño o secretaria vinculada.
  - Se reemplazaron las policies de `consultations`, `doctor_consultation_types` y `precita_tokens` para usar helpers de acceso por doctor.
  - Se revocó acceso directo `anon` a las tablas/vistas core de F-14/F-16: `doctors`, `secretaries`, `secretary_doctors`, `consultations`, `doctor_consultation_types`, `precita_tokens`, `doctor_metrics_monthly` y `specialty_benchmarks_monthly`.
  - Validación: doctor y secretaria autenticados siguen leyendo métricas F-14; `anon` ya no tiene `select/insert/update/delete` directo sobre esas tablas/vistas.
- RLS por rol de app, fase 2A aplicada por Codex el 13 de mayo de 2026:
  - Se agregó `private.can_access_patient(p_patient_id text)`.
  - Se reemplazaron `demo_read`/`demo_write` en `patients` y `agenda_slots`.
  - `patients`: doctor dueño o secretaria vinculada pueden leer/crear/editar; no hay delete directo.
  - `agenda_slots`: doctor dueño o secretaria vinculada pueden leer/crear/editar/eliminar citas autorizadas.
  - Se revocó acceso directo `anon` a `patients` y `agenda_slots`.
  - Se corrigió la cita de Carlos Herrera de las 18:30 que había quedado en `2026-05-14` por el bug UTC; ahora está en `2026-05-13`.
  - Validación: doctor y secretaria ven 4 pacientes y 4 citas del Dr. R. Villarreal el 13 de mayo de 2026; Advisor ya no reporta `demo_write` para `patients` ni `agenda_slots`.
- RLS por rol de app, fase 2B aplicada por Codex el 13 de mayo de 2026:
  - Se reemplazaron `demo_read`/`demo_write` en `labs`, `patient_documents` y `patient_history`.
  - `labs`: doctor dueño o secretaria vinculada pueden leer/crear/editar labs del paciente autorizado; no hay delete directo.
  - `patient_documents`: doctor dueño o secretaria vinculada pueden leer/subir/eliminar documentos del paciente autorizado; no hay update directo.
  - `patient_history`: doctor dueño o secretaria vinculada pueden leer/agregar historial del paciente autorizado; no hay update/delete directo.
  - Se revocó acceso directo `anon` a `labs`, `patient_documents` y `patient_history`.
  - Validación: doctor y secretaria ven 2 labs, 3 documentos y 8 eventos de historial actuales; secretaria puede insertar labs/documentos/historial en pruebas con rollback.
- Patient history estructurado aplicado por Codex el 14 de mayo de 2026:
  - `patient_history` conserva los campos MVP (`type`, `title`, `description`, `icon`, `created_at`) y ahora agrega ligas estructuradas: `doctor_id`, `agenda_slot_id`, `consultation_id`, `precita_token_id`, `document_id`, `lab_id`, `source_table`, `source_id`, `event_type`, `occurred_at`, `metadata`, `created_by`.
  - Se agregaron índices para consultas por paciente/fecha clínica, cita, consulta, pre-cita, documento, lab, tipo de evento y fuente.
  - Se creó helper privado `private.record_patient_history_event(...)`, no ejecutable por `anon` ni `authenticated`, para que funciones privadas registren eventos ligados sin exponer privilegios.
  - `private.submit_precita` ahora registra automáticamente evento `precita_submitted` ligado a `agenda_slot_id` y `precita_token_id` cuando el paciente envía el cuestionario.
  - Backfill aplicado: documentos existentes, consultas cerradas, labs existentes y pre-citas ya enviadas quedaron ligados cuando la fuente se pudo identificar. Algunos eventos legacy antiguos quedan visibles sin `event_type` porque no tienen fuente confiable.
  - Policy de INSERT endurecida: usuarios autenticados solo pueden insertar historial de pacientes accesibles y las ligas (`agenda_slot_id`, `document_id`, `lab_id`, `precita_token_id`, etc.) deben pertenecer al mismo paciente.
- Document Storage hardening aplicado por Codex el 14 de mayo de 2026:
  - Los archivos reales viven en Supabase Storage privado (`estudios`, `polizas`); Postgres solo guarda metadata en `patient_documents`.
  - Se eliminaron policies amplias de `storage.objects` que permitían a cualquier usuario `authenticated` operar sobre todo el bucket.
  - Nuevas policies `mc_documents_*_patient_scoped` permiten select/insert/update/delete solo si la ruta empieza con `patient_id/` y `private.can_access_patient(patient_id)` devuelve true.
  - `patient_documents.patient_id`, `bucket` y `storage_path` ahora son obligatorios; `url` es nullable porque la app debe generar signed URLs al leer.
  - Constraint `patient_documents_storage_path_matches_patient` evita metadata que apunte a una ruta de otro paciente.
  - `src/api/secretary.ts` ya no guarda `getPublicUrl`; al listar genera signed URLs y al borrar elimina también el objeto de Storage.
- Legacy data cleanup aplicado por Codex el 14 de mayo de 2026:
  - Se ligó a Carlos Herrera un slot antiguo que solo tenía `name` pero no `patient_id`.
  - Se recuperó un objeto huérfano de Storage como `patient_documents` + evento `document_uploaded`.
  - Se limpiaron URLs públicas antiguas en `patient_documents.url`; la app usa signed URLs.
  - Los 5 eventos legacy sin `event_type` fueron convertidos a `legacy_consultation_note` o `legacy_order_note`, preservando metadata original y ligas posibles.
  - Citas pasadas anteriores al 14 de mayo de 2026 local que seguían `upcoming/waiting` fueron marcadas `cancelled` con razón explícita de limpieza; no se crearon consultas ni ingresos falsos.
  - `agenda_slots_status_check` ahora admite `cancelled`, alineado con el frontend.
  - Se corrigieron rutas futuras para que documentos, cierre de consulta, pendientes y `extract-labs` escriban historial estructurado con `event_type/source_table/source_id`.
- RLS por rol de app, fase 2C aplicada por Codex el 13 de mayo de 2026:
  - Se reemplazaron `demo_read`/`demo_write` en `alerts`, `inbox_items`, `chat_messages` y `pending_items`.
  - `alerts`: doctor dueño o secretaria vinculada solo pueden leer alertas del paciente autorizado; la generación de alertas queda para service role o RPC futura.
  - `inbox_items`: doctor dueño o secretaria vinculada pueden leer/actualizar inbox del paciente autorizado.
  - `chat_messages`: doctor dueño o secretaria vinculada pueden leer/enviar mensajes del paciente autorizado; no hay update/delete directo.
  - `pending_items`: doctor dueño o secretaria vinculada pueden leer/crear/resolver pendientes; nuevos pendientes deben estar ligados a un paciente autorizado.
  - Se revocó acceso directo `anon` a las cuatro tablas operativas.
  - Validación: doctor y secretaria pueden leer las tablas operativas actuales y crear `chat_messages`/`pending_items` en pruebas con rollback; Advisor Security ya no reporta `demo_write`.

### Pendientes
**Bloqueantes ahora**
- Ninguno para continuar con F-16.

**Pre-producción**
- Activar leaked password protection en Supabase Auth.
- Crear índices para foreign keys que Advisor Performance marca sin índice en rutas activas (`agenda_slots`, `patients`, `alerts`, `chat_messages`, `inbox_items`, `labs`, `pending_items`, `secretary_doctors`, `doctors`).
- Revisar/optimizar policies antiguas que sigan usando `auth.uid()` directo en vez de `(select auth.uid())` si Advisor las vuelve a reportar.

**Bajo riesgo**
- Revisar warnings `unused_index` después de tráfico real; no borrar índices de F-14/F-16 todavía porque varios son nuevos y Advisor puede marcarlos como no usados antes de que haya volumen.

### Match a Eleonor
Eleonor tiene control de ingresos y reportes de consulta/cirugía, pero Muguerza Connect añade comparativo anónimo por especialidad, cash ligado a agenda real, catálogo de precios por doctor y storytelling visual del paciente.

---

## ✅ F-16 · Pre-cita del paciente (cuestionario 24h antes)

**Estado:** Implementado y compilado — mayo 2026
**Motor:** M1 + M2 · **Costo real:** $0 · **IA requerida:** No

### Estado
Supabase aplicado por Codex el 13 de mayo de 2026. React/API implementado el 14 de mayo de 2026. Base estructurada de historial aplicada por Codex el 14 de mayo de 2026 para ligar pre-cita, cita, consulta, documento y lab a fuentes reales.

### Supabase aplicado
- Tabla `precita_tokens`: `id`, `token_hash`, `agenda_slot_id`, `patient_id`, `doctor_id`, `expires_at`, `submitted_at`, `payload jsonb`, `created_by`, `created_at`, `updated_at`.
- El token real no se guarda. Solo se guarda `token_hash` con SHA-256; el token crudo se entrega una sola vez al generar el link.
- RLS activo en `precita_tokens`. No hay policies para `anon` sobre la tabla.
- Policies de lectura directa solo para doctor y secretaria vinculada:
  - `Doctor lee precitas de sus pacientes`
  - `Secretaria lee precitas de sus doctores`
- RPC pública expuesta en `public` como wrappers `SECURITY INVOKER`:
  - `generate_precita_token(p_agenda_slot_id uuid, p_expires_in_hours integer default 24)` — solo `authenticated`.
  - `get_precita_by_token(p_token text)` — `anon` y `authenticated`.
  - `submit_precita(p_token text, p_payload jsonb)` — `anon` y `authenticated`.
- La lógica privilegiada vive en schema `private` como funciones `SECURITY DEFINER` no expuestas por REST.
- Índices creados para `agenda_slot_id`, `patient_id`, `doctor_id`, `expires_at`, `submitted_at`, `created_by` y `token_hash`.
- Hotfix DB aplicado por Codex el 14 de mayo de 2026: `private.generate_precita_token` ahora usa variable local `v_expires_at`, califica columnas de `precita_tokens` y valida `can_generate is not true`. Corrige el error `column reference "expires_at" is ambiguous` al generar links y evita que un usuario autenticado sin rol doctor/secretaria pase por un `NULL` en la validación.

### Cómo debe funcionar
- Secretaria o doctor autenticado genera el link desde una cita real (`agenda_slot_id`) usando `generate_precita_token`.
- La función valida que el usuario sea el doctor de la cita o una secretaria vinculada a ese doctor.
- El link público debe apuntar a `/precita/:token`.
- El paciente abre el link sin login. La ruta pública solo llama `get_precita_by_token` y `submit_precita`.
- Estados esperados del token: `invalid`, `expired`, `submitted`, `open`.
- El token es de un solo uso: después de `submitted_at`, el formulario queda bloqueado.
- Si se genera un nuevo token para la misma cita, los tokens activos anteriores de esa cita se expiran.

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/api/precita.ts` | `generatePrecitaToken`, `getPrecita`, `submitPrecita` (wrappers RPC) + `getLatestPrecitaForPatient` + `getPrecitaStatusesForSlots` (consultas directas autenticadas) |
| `src/components/PrecitaForm.tsx` | Formulario público mobile-first — maneja estados `invalid`, `expired`, `submitted`, `open`; 8 campos versionados en `payload jsonb` |
| `src/components/PrecitaSummaryCard.tsx` | Card autenticado en expediente del doctor — muestra campos del payload si existe precita enviada |

### Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/App.tsx` | Ruta pública `/precita/:token` interceptada en `App` antes de cualquier hook; lógica de auth movida a `AuthApp` |
| `src/components/SecretaryDesktop.tsx` | Importa `generatePrecitaToken`, `getPrecitaStatusesForSlots`; AgendaPanel: estado `precitaStatuses`, `sendingPrecita`; useEffect para cargar statuses al cambiar slots; `handleSendPrecita` genera token, arma mensaje WhatsApp, copia al clipboard; badge de estado por slot; botón "📋 Pre-cita" en slots upcoming/waiting con paciente |
| `src/components/DesktopPatient.tsx` | Importa `PrecitaSummaryCard`; se renderiza en tab "resumen" bajo los datos clínicos (solo si hay precita enviada) |
| `src/api/index.ts` | Export de `precita.ts` en barrel |

### Decisiones técnicas
- **Ruta pública sin router externo** — `window.location.pathname.match(/^\/precita\/([^/?]+)/)` en el componente raíz antes de montar el flujo de auth. No se añadió React Router para no alterar la arquitectura existente.
- **AuthApp como componente separado** — permite el early-return limpio en `App` sin violar las reglas de hooks (no se puede retornar condicionalmente antes de useState/useEffect en el mismo componente).
- **Sin queries directas en ruta pública** — `PrecitaForm` solo llama `getPrecita` y `submitPrecita` (RPCs `SECURITY DEFINER` en `private`, expuestas como wrappers en `public`). Nunca toca `precita_tokens` directamente.
- **Token de un solo uso** — la DB maneja esto: `submit_precita` usa `FOR UPDATE` + verificación de `submitted_at IS NOT NULL` + verificación de expiración. El formulario bloquea el campo después de enviar.
- **Expiración según trigger** — `get_precita_by_token` retorna `expired` si `expires_at <= now()`, incluso si ya se submitió (diseño Codex). Para el portal autenticado `getLatestPrecitaForPatient` lee directamente `submitted_at IS NOT NULL`, así el doctor siempre ve la respuesta aunque el token haya expirado.
- **Badge de precita en agenda** — `getPrecitaStatusesForSlots` consulta `precita_tokens` con el cliente autenticado (RLS permite doctor y secretaria). Se recarga al cambiar la lista de slots y después de generar un token nuevo.
- **payload + `submitted_from`** — Supabase añade `submitted_from: 'public_precita'` al JSON. `PrecitaSummaryCard` itera solo los campos de `DISPLAY_ORDER` para ignorarlo.
- **Generación validada con rollback** — `generate_precita_token` fue probado como secretaria y doctor autenticados contra una cita real, devolviendo token de 64 caracteres y expiración futura. `anon` sigue sin permiso de ejecución.
- **Historial ligado a pre-cita** — `submit_precita` ahora crea un evento `patient_history.event_type = 'precita_submitted'` con `agenda_slot_id`, `precita_token_id`, `source_table = 'precita_tokens'` y `source_id` del token. Esto permite mostrar la respuesta por cita específica y no solo la última pre-cita del paciente.

### Payload MVP recomendado
Mantenerlo fijo y versionado en JSON para no abrir todavía un constructor de formularios:

```json
{
  "version": 1,
  "chief_complaint": "",
  "symptoms": "",
  "symptom_started_at": "",
  "severity": "",
  "current_medications": "",
  "allergies": "",
  "relevant_history": "",
  "additional_notes": ""
}
```

### Privacidad y seguridad
- No hacer `select`, `insert` ni `update` directo a `precita_tokens` desde la ruta pública.
- No exponer expediente, labs, documentos, aseguradora ni historial por el link.
- `get_precita_by_token` solo regresa contexto mínimo: doctor, especialidad, fecha/hora, paciente y motivo si existe.
- Las respuestas médicas completas viven en `payload` y solo deben mostrarse dentro del portal autenticado del doctor/secretaria autorizada.
- Advisor quedó sin warnings nuevos de funciones `SECURITY DEFINER` públicas. Las vistas F-14 `doctor_metrics_monthly` y `specialty_benchmarks_monthly` ya fueron endurecidas con `security_invoker=true`. La fase 1 de RLS real cubre identidad/equipo y tablas core F-14/F-16; la fase 2A cubre `patients` y `agenda_slots`; la fase 2B cubre `labs`, `patient_documents` y `patient_history`; la fase 2C cubre `alerts`, `inbox_items`, `chat_messages` y `pending_items`. Siguen pendientes globales pre-producción: leaked password protection y limpieza de performance.

### UI/API local estructurado — aplicado 14 de mayo de 2026

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `src/api/secretary.ts` | `listHistory` ahora ordena por `occurred_at DESC NULLS LAST, created_at DESC`; selecciona `*` (incluye nuevos campos) |
| `src/api/precita.ts` | Nueva función `getPrecitaForSlot(agendaSlotId)` — consulta `precita_tokens` autenticado por slot específico |
| `src/components/PrecitaSummaryCard.tsx` | Prop opcional `agendaSlotId`; si se pasa usa `getPrecitaForSlot`, si no usa `getLatestPrecitaForPatient`; muestra label "Última pre-cita enviada" cuando usa fallback |
| `src/components/DesktopPatient.tsx` | Tab Historial: usa `occurred_at ?? created_at` para fecha visible; mapeo `event_type` → ícono, color y badge label; eventos sin `event_type` mantienen comportamiento legacy; cada evento se puede abrir inline para ver detalles ligados a consulta, pre-cita, documento o lab |
| `src/components/SecretaryDesktop.tsx` | Importa `getPrecitaForSlot`, `PrecitaRecord`; estados `viewingPrecitaSlot` y `viewingPrecitaData`; botón "▼ Ver respuesta" en slots con `submitted`; expansión inline con campos del payload |

**Decisiones técnicas:**
- `listHistory` usa doble `.order()` de Supabase PostgREST: `occurred_at DESC NULLS LAST` primero, `created_at DESC` como tiebreaker para legacy.
- `getPrecitaForSlot` consulta solo `precita_tokens` con `submitted_at IS NOT NULL`, trae la más reciente por slot.
- `PrecitaSummaryCard` acepta `agendaSlotId?: string` sin romper ningún caller existente (prop opcional).
- El historial por paciente ahora es navegable: un clic sobre el evento expande metadatos y IDs fuente; en pre-cita consulta el payload por `agenda_slot_id`.
- La expansión inline en agenda es toggle (clic abre, segundo clic cierra), con cache por `slotId` en `viewingPrecitaData` para no recargar al abrir/cerrar.
- Los campos del payload en el inline view usan grid 2 columnas (compacto para agenda), distinto al card completo en expediente.
- `tsc -b` pasó sin errores después de todos los cambios.

**Validación:**
- TypeScript 0 errores.
- Ruta pública `/precita/:token` no fue tocada — sigue usando solo `get_precita_by_token` y `submit_precita`.
- RLS, migraciones y RPCs sin cambios.
- Registros legacy sin `event_type` siguen renderizando con `icoMap[e.icon]` y `colorMap[e.type]`.
- Una cita `upcoming` no se muestra como "Consulta" en historial hasta que exista evento de cierre/atención o fila en `consultations`; puede aparecer como pre-cita si el paciente ya envió cuestionario.

**Pendientes pre-producción:**
- Hacer que cierre de consulta y subida de documentos inserten historial estructurado (con `event_type`, `source_id`, etc.) desde el cliente o mover a RPCs privadas.
- Agregar filtros por `event_type` y cita en el tab Historial.
- Pantalla de "timeline por cita" con precita, docs, labs, cierre y órdenes agrupados.

---

## 🟡 F-10 · Referido interno frictionless entre especialidades

**Motor:** M3 · **Costo:** $0 · **Bloqueante:** necesita un segundo doctor de otra especialidad en Supabase

Doctor ve agenda en vivo de otra especialidad Muguerza y agenda directo. Tabla nueva `referrals` (estado, motivo, doctor_origen → doctor_destino, slot reservado). La palanca económica más grande del producto.

---

## 🟡 F-17 · Co-management entre especialistas

**Motor:** M3 · **Bloqueante:** segundo doctor

Dos doctores comparten vista del paciente con hilo de comentarios asincrónicos. Tablas: `case_collaborators` (patient_id, doctor_id, role) + `case_notes`. Único en el mercado mexicano.

---

## 🟡 F-13 · Marketplace de slots cancelados

**Motor:** M3 + M1 · **Bloqueante:** canal de notificación al paciente (WhatsApp o push)

Slot cancelado → se ofrece automáticamente a pacientes en lista de espera. Nueva tabla `waitlist` (patient_id, doctor_id, urgencia, fecha_max).

---

## 🟡 F-15 · Connect en iPad para visita hospitalaria

**Motor:** M1 · **Bloqueante:** decidir PWA vs app nativa

Versión touch del expediente para pase de visita. Vacío grande en el mercado — hoy escriben en papel.

---

## 🔴 F-1 · Nota clínica con IA en vivo durante consulta

**Motor:** M1 (el más fuerte del producto) · **Costo estimado:** ~$0.10–$0.30 USD/consulta
**Requiere:** API Anthropic + API de transcripción de voz (Whisper o similar) + aviso de privacidad firmado

Micrófono escucha la consulta, IA transcribe y genera nota SOAP estructurada, el doctor aprueba/edita. El "iPhone moment" de Muguerza Connect. Tabla nueva `clinical_notes` con versión raw + estructurada.

---

## 🔴 F-7 · Indicaciones post-consulta auto-generadas al paciente

**Costo estimado:** ~$0.05 USD/consulta · **Requiere:** API Anthropic

Al cerrar la nota, IA genera PDF + mensaje WhatsApp con el plan en lenguaje del paciente, fotos de empaques de medicinas y señales de alarma.

---

## 🔴 F-8 · Segunda opinión asistida por IA (privada al doctor)

**Requiere:** API Anthropic (Sonnet o superior)

El doctor solicita diagnóstico diferencial + literatura citada sobre un caso difícil. Nunca visible al paciente. Feature de retención puro.

---

## 🔴 F-5 · Bridge WhatsApp ↔ Connect

**Costo:** WhatsApp Business API (~$0.005/msg) + IA para clasificación

Mensajes del paciente entran a Connect, IA clasifica urgente/rutina/admin, secretaria responde lo administrativo desde Connect.

---

## Apéndice — Benchmark Eleonor (mayo 2026)

| Módulo Eleonor | Estado Muguerza Connect | Acción |
|---|---|---|
| Control y estadísticas de ingresos | ❌ | F-14 cubre y supera |
| Facturación electrónica | ❌ | Backlog post-MVP |
| Reporte estadístico de consultas | ❌ | F-14 cubre |
| Telemedicina / videoconsulta | ❌ | Backlog (Daily/Twilio) |
| Interconsultas digitales | 🟡 parcial | F-17 lo formaliza |
| Recordatorios automáticos | 🟡 parcial | F-16 + WhatsApp |
| Módulo de asistente con permisos | ✅ portal secretaria | **superior a Eleonor** |
| Cobros online (Stripe/PayPal/Oxxo) | ❌ | Backlog post-MVP |
| Receta electrónica | 🟡 parcial | F-2 lo formaliza |
| Informes para aseguradoras | ✅ DesktopAseguradoras | ya cubierto |

**Diferenciadores donde Eleonor no tiene nada:**
Pre-consulta automática (✅ F-3 implementado), pre-cita del paciente (F-16), referido frictionless (F-10), co-management (F-17), storytelling del paciente (F-14+6), IA clínica (F-1, F-7, F-8), marketplace de slots (F-13).

---

## ✅ Limpieza de repositorio inicial — 17 de mayo de 2026

**Estado:** Aplicado localmente por Codex.

### Qué se depuró
- Se eliminaron artefactos generados `vite.config.js` y `vite.config.d.ts`; la fuente real es `vite.config.ts`.
- `tsconfig.node.json` ahora usa `noEmit: true` y `tsconfig.json` incluye `vite.config.ts` sin referencia de build, para no volver a generar outputs del config de Vite.
- Se eliminó `src/data/seed.ts`, placeholder de datos demo ya no importado. La fuente de verdad actual es Supabase y los datos demo viven en `supabase/seed.sql`.
- Se eliminó `src/api/storage.ts`, helper no usado que podía invitar a uploads directos sin metadata/historial. Los documentos deben pasar por `src/api/secretary.ts`.
- Se corrigió el orden de `@import` en `src/styles.css`.
- `SecretaryDesktop` dejó imports dinámicos redundantes y usa funciones directas de `src/api/secretary.ts` y `src/api/pending.ts`.
- `README.md` fue actualizado para reflejar la estructura real.

### Validación
- `npm.cmd run build` pasa fuera del sandbox.
- Avisos restantes: bundle principal grande y oportunidades de code-splitting; no se tocaron en esta limpieza para evitar refactor amplio.

### No eliminado en esta pasada
- `handoffs/` y `reviews/`: se conservan porque documentan RLS, Storage, F-16, Azure y limpieza legacy.
- `src/shell.css` y `VITE_DEMO_MAC_SHELL`: se conservan temporalmente porque el README los documenta como modo demo opcional. Requiere decisión de producto antes de borrarlo.

### Limpieza local adicional
- `.vscode/settings.json` se eliminó del repo porque solo configuraba Live Server (`5501`), herramienta no usada por Vite.
- `.claude/` y `.vscode/` quedaron ignorados como configuración local de máquina.
- Se limpiaron artefactos regenerables locales: `dist/`, `*.tsbuildinfo` y `supabase/.temp/`.
- Se conservaron `.env.local` y `node_modules/` en la máquina para poder seguir desarrollando localmente; ambos siguen fuera de Git.
