## ✅ Módulo Clínicas Ambulatorias — mayo 2026

**Estado:** Implementado — shell UI + BD + RLS. Integración WhatsApp pendiente.
**Motor:** M1 + M3 · **Costo real:** $0 · **IA requerida:** No

### Contexto

En mayo 2026 se clarificó que Muguerza Connect tiene dos módulos con lógicas completamente distintas. El módulo de clínicas ambulatorias (CEI — Centros de Especialidad e Infusión) opera con una lógica de staff clínico, servicios ambulatorios (infusiones, laboratorio, imagen, cirugía ambulatoria, consulta), pre-autorización de aseguradoras y escalamientos de emergencia. No comparte lógica de BD con el módulo de consultorio privado.

### Supabase — tablas creadas

Proyecto: `egehyxbtxjnlkwvlndgr`. Migración: `clinic_ambulatorio_module`.

| Tabla | Descripción |
|---|---|
| `public.clinics` | Catálogo de clínicas (orgánica / spoke). |
| `public.clinic_staff` | Staff de cada clínica. Vinculado a `auth.users`. |
| `public.clinic_services` | Servicios que ofrece cada clínica (infusión, lab, imagen, cirugía, consulta). |
| `public.service_appointments` | Citas para cada servicio. Estado y pre-auth por fila. |
| `public.pre_auth_requests` | Solicitudes de pre-autorización a aseguradoras. |
| `public.service_results` | Resultados de servicios (lab, imagen, nota de procedimiento). |
| `public.clinical_escalations` | Escalamientos de emergencia (hub hospital, 911, otro). |

### RLS y seguridad

- Helper privados: `private.current_clinic_staff_id()`, `private.is_clinic_staff_for(p_clinic_id)`, `private.can_access_appointment(p_appointment_id)`.
- Políticas completas en las 7 tablas — solo staff activo de la propia clínica puede leer/escribir.
- `REVOKE ALL FROM anon` en todas las tablas del módulo.
- Doctores y secretarias del módulo de consultorio no tienen grants sobre estas tablas.
- Indexes en `clinic_id`, `patient_id`, `scheduled_at`, `status`, `pre_auth_status`.

### Auditoria base Codex - 29 de mayo de 2026

**Estado:** Verificado contra Supabase vivo y codigo local. Este bloque es solo
auditoria/documentacion; no se aplicaron migraciones, no se crearon tablas y no
se modifico runtime de la app.

#### Estado verificado por Codex

- Proyecto Supabase activo: `egehyxbtxjnlkwvlndgr` (`sauljuarezhp-alt's Project`), region `us-east-1`, estado `ACTIVE_HEALTHY`, Postgres `17.6.1.110`.
- Edge Functions activas: solo `extract-labs` (`verify_jwt: true`). No existe todavia Edge Function clinic, `whatsapp-webhook`, `book_appointment` ni funcion outbound WhatsApp.
- Migraciones clinic aplicadas en Supabase:
  - `20260528190814 clinic_ambulatorio_module`
  - `20260528194150 clinic_crm_messaging`
  - `20260528200244 clinic_capacity_resources`
  - `20260528200400 clinic_drop_patient_fk`
- El repo local no contiene SQL versionado de esas migraciones clinic en `supabase/schema.sql`, `supabase/seed.sql` ni `supabase/lab_extraction_patch.sql`; el estado real vive hoy en Supabase y en este ledger.
- Storage actual verificado: solo 2 buckets en `storage.buckets` y 4 objetos en `storage.objects`; no existen todavia buckets clinic dedicados como `clinic-results`, `clinic-chat-attachments` o `clinic-orders`.

#### Tablas actuales y huecos

| Tabla | RLS | Filas vivas | Hueco principal |
|---|---:|---:|---|
| `public.clinics` | si | verificado | Falta indice FK de `hub_clinic_id`; flujo hub-spoke aun no esta implementado. |
| `public.clinic_staff` | si | 1 | MFA obligatorio y pruebas de staff inactivo siguen pendientes. |
| `public.clinic_services` | si | 7 | Falta metadata operativa: preparacion, costo lista/aseguradora, capacidades requeridas. |
| `public.service_appointments` | si | 12 | Usa `patient_id text` sin `clinic_patients`; falta reserva de recurso, doble-booking y mutaciones via RPC/Edge. |
| `public.pre_auth_requests` | si | 9 | Falta SLA, adjuntos privados reales, auditoria y cifrado de notas sensibles. |
| `public.service_results` | si | 3 | `storage_path` existe, pero falta bucket clinic privado y signed URLs desde API. |
| `public.clinical_escalations` | si | 2 | Solo visualizacion; falta crear/resolver desde flujo auditado. |
| `public.clinic_conversations` | si | 5 | Demo local; falta webhook real, SLA, auditoria de status/asignacion y vinculo operativo con citas. |
| `public.clinic_chat_messages` | si | 17 | Falta outbound real, adjuntos privados y `author_staff_id` en mensajes enviados desde staff. |
| `public.clinic_resources` | si | 13 | Falta horarios, bloqueos, capacidades, mantenimiento y costo operativo. |
| `public.clinic_resource_assignments` | si | 6 | Asigna al pasar a `in_progress`; falta pre-asignacion al agendar y reasignacion con motivo. |

#### Riesgos criticos actuales

- No existe `clinic_patients`: agenda, pre-auth, resultados, recursos y CRM dependen de `patient_id text` y/o `patient_name` denormalizado. Este es el primer gap a cerrar para evitar mezclar el modulo clinic con `public.patients` del consultorio privado.
- Varias mutaciones sensibles siguen saliendo desde el cliente web con `supabase.from(...).update/insert(...)`; RLS ayuda, pero no reemplaza validaciones de transicion, auditoria, rate limiting ni registro de motivo.
- `service_results.storage_path` y futuros adjuntos no tienen todavia bucket clinic privado ni generacion obligatoria de signed URLs.
- No hay `clinic_audit_log`; cambios de cita, preautorizacion, resultado, conversacion y recursos no tienen trazabilidad suficiente para pre-produccion.
- No hay MFA obligatorio para `clinic_staff`, ni bloqueo de UI si el factor TOTP no esta verificado.
- La auditoria de RLS detallada por policies/grants debe ejecutarse antes de abrir el modulo a usuarios reales; esta pasada confirmo RLS encendido por tabla via connector, no hizo pen test inter-clinica.

#### Mutaciones cliente que deben moverse a RPC/Edge

Archivo auditado: `src/api/clinic.ts`.

| Funcion local | Tabla afectada | Riesgo | Destino recomendado |
|---|---|---|---|
| `updateAppointmentStatus` | `service_appointments` | Transiciones sin motivo/auditoria/rate limit. | RPC `private.update_clinic_appointment_status` o Edge Function validada. |
| `updatePreAuthStatus` | `pre_auth_requests` | Aprobacion/rechazo sin SLA, actor fuerte ni auditoria. | RPC `private.update_clinic_preauth_status`. |
| `sendConversationMessage` | `clinic_chat_messages` | Escribe BD pero no envia WhatsApp real; no registra `author_staff_id`. | Edge Function outbound WhatsApp + insert auditado. |
| `updateConversationStatus` | `clinic_conversations` | Cambios de asignacion/status sin historial. | RPC con `clinic_conversation_audit`. |
| `markConversationRead` | `clinic_conversations` | Mutacion menor, pero debe validar staff/clinica y mantener auditoria ligera. | RPC o funcion local despues de endurecer policies. |
| `manualAssignResource` | `clinic_resource_assignments` | Libera/asigna recurso sin motivo y con doble operacion cliente. | RPC transaccional con validacion de disponibilidad. |
| `freeResource` | `clinic_resource_assignments` | Libera recurso sin motivo ni actor. | RPC `private.free_clinic_resource_assignment`. |

#### Advisors relevantes

- Security Advisor:
  - `function_search_path_mutable`: `private.set_updated_at` no tiene `search_path` fijo. Remediar con una migracion dedicada antes de seguir agregando triggers nuevos.
  - `auth_leaked_password_protection`: leaked password protection esta desactivado. Activarlo desde Supabase Auth antes de piloto real.
- Performance Advisor, prioridad clinic:
  - FKs sin indice: `clinic_chat_messages.author_staff_id`, `clinic_conversations.related_appointment_id`, `clinic_resource_assignments.assigned_by`, `clinical_escalations.service_appointment_id`, `clinical_escalations.triggered_by`, `clinics.hub_clinic_id`, `pre_auth_requests.created_by`, `service_appointments.created_by`, `service_appointments.doctor_id`, `service_appointments.service_id`, `service_results.reviewed_by`.
  - Indices clinic marcados como unused: `idx_assignments_appointment`, `idx_svc_appt_patient`, `idx_pre_auth_appt`, `idx_svc_results_appt`, `idx_clinic_conv_clinic`, `idx_clinic_conv_status`, `idx_clinic_conv_assigned`, `idx_clinic_msg_clinic`. No eliminarlos todavia; son recientes/demo y pueden volverse utiles al aumentar trafico.

#### Proximo mini plan recomendado

Mini Plan 1 debe ser `clinic_patients`: crear la tabla propia de pacientes de clinica, definir RLS por `clinic_id`, migrar/sembrar los IDs demo actuales, actualizar lecturas para mostrar nombre real desde `clinic_patients`, y dejar documentado que `public.patients` sigue perteneciendo al modulo de consultorio privado.

### Archivos creados

| Archivo | Descripción |
|---|---|
| `src/api/clinic.ts` | Capa de API: `getCurrentClinicStaff`, `listTodayAppointments`, `listAllAppointments`, `listPreAuthRequests`, `listServiceResults`, `listActiveEscalations`, `updateAppointmentStatus`, `updatePreAuthStatus`. |
| `src/components/ClinicDesktop.tsx` | Shell completo: sidebar 220px con identificación de clínica, nav de 7 secciones, topbar con alerta de escalamientos activos, 7 vistas inline. |
| `muguerza-journeys/NOTA-CONTEXTO.md` | Nota de contexto para journeys — distingue módulo consultorio vs. ambulatorio. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types.ts` | Tipos `Clinic`, `ClinicStaff`, `ServiceAppointment`, `PreAuthRequest`, `ServiceResult`, `ClinicalEscalation`, `AppointmentStatus`, `PreAuthStatus`. |
| `src/App.tsx` | `type Role` incluye `'clinic_staff'`. `detectRole()` consulta `clinic_staff`. Renderiza `<ClinicDesktop />` cuando el usuario tiene ese rol. |

### Vistas implementadas en ClinicDesktop

| Sección | Contenido |
|---|---|
| Panel del día | KPIs del día (citas, check-in, completadas, pre-auth pendiente, escalamientos). Alerta de escalamientos activos. Lista de citas pendientes del día. |
| Agenda | Tabla completa con filtros por estado y tipo de servicio. Acciones de avance de estado (Programada → Check-in → En progreso → Completada). |
| Pre-autorización | Lista de solicitudes con filtros por estado. Acciones de aprobación / rechazo / marcar en revisión. |
| Bandeja | Placeholder WhatsApp — nota de integración pendiente. |
| Resultados | Lista de resultados recientes. Resaltado de críticos sin notificar. |
| Aseguradoras | Tabla agrupada por aseguradora: citas totales, completadas, pre-auth pendiente y aprobada. |
| Rendimiento | KPIs globales, tasa de completación, barras de distribución por tipo de servicio. |

### Diseño

Mismo sistema de diseño que MCDesktop y SecretaryDesktop:
- Sidebar 220px, `gridTemplateColumns: '220px 1fr'`.
- Fuente `Franklin Gothic Book / Libre Franklin`.
- Brand `#671E75` (light) / `#C47DD0` (dark).
- Tokens de tema del `ThemeContext`.
- Subtitle sidebar: `"Clínica Ambulatoria"` (vs. `"Web · Consultorio"`).
- Chip de nombre de clínica en el sidebar.

### Hardening pendiente (Codex)

Cyberseguridad pre-producción para el módulo ambulatorio:

1. **Audit log** — tabla `clinic_audit_log` con trigger para INSERT/UPDATE/DELETE en `service_appointments`, `pre_auth_requests` y `service_results`. Incluir `actor_id`, `table_name`, `row_id`, `action`, `old_data`, `new_data`, `ip_addr` (via request headers de Edge Function).
2. **MFA obligatorio** para `clinic_staff` — forzar TOTP antes de acceso a datos de pacientes. Supabase Auth tiene TOTP nativo.
3. **Rate limiting** en `updateAppointmentStatus` y `updatePreAuthStatus` — Edge Function intermediaria o `pg_net` con límite de mutaciones por minuto por usuario.
4. **Signed URLs** para `service_results.storage_path` — acceso temporal, nunca URLs permanentes.
5. **Cifrado de campos sensibles** — `notes` en `service_appointments` y `pre_auth_requests` deben cifrase at-rest con `pgcrypto` si contienen diagnósticos o información clínica identificable.
6. **Aislamiento inter-clínica** — verificar que `private.is_clinic_staff_for()` no pueda escalarse a otra clínica por cambio de `clinic_id` en el token JWT. Pen test del RLS.
7. **NOM-024 / HIPAA review** — clasificar qué campos son PHI, documentar retención, anonimización y proceso de borrado de datos de pacientes.
8. **Service role key** — nunca exponer en el cliente. `updateAppointmentStatus` y `updatePreAuthStatus` deben pasar por Edge Function que valide el usuario activo antes de mutar.
9. **IP allowlisting** — en producción, restringir el proyecto Supabase a las IPs de la clínica o VPN Muguerza.
10. **Dependency audit** — `npm audit` y revisión trimestral de dependencias de `clinic.ts`.

### Validación realizada

- `tsc --noEmit` pasa limpio.
- `npm run build` pasa con bundle de 970 KB (warning de chunk size es pre-existente, no relacionado con el módulo).
- Role detection en `App.tsx` consulta `clinic_staff.active = true` — un staff desactivado en BD queda fuera sin necesidad de invalidar sesión.
- Realtime subscriptions registradas en `ClinicDesktop` para las 4 tablas mutables.

### Limitaciones conocidas

- Los `patient_name` en las citas se muestran como `patient_id` (text) porque los pacientes del módulo ambulatorio no están todavía en la tabla `patients` del módulo de consultorio. Requiere definir si se comparte la tabla `patients` o si se crea `clinic_patients` separada.
- El módulo no tiene su propio formulario de nueva cita todavía — las citas se crean solo desde BD directamente o API.
- Escalamientos solo se visualizan, no se crean desde la UI todavía.

---

## ✅ CRM / Bandeja WhatsApp clínica ambulatoria — mayo 2026

**Estado:** Implementado — UI + BD + RLS + datos demo. Integración real de WhatsApp Business API pendiente.
**Motor:** M1 + M3 · **Costo real:** $0 hasta integrar WhatsApp · **IA requerida:** No (el bot vive afuera)

### Contexto

La estrategia ambulatoria define un flujo: paciente contacta vía WhatsApp → Muguerza Concierge (bot) → handoff a humano del equipo operativo de la clínica → resolución. La Bandeja del módulo clínica reemplaza al placeholder anterior y se acopla a este flujo.

**Diseño deliberadamente separado del CRM del módulo de consultorio** (`public.chat_messages` + `private.can_access_patient` viven en la lógica de doctor/secretaria, basada en `doctors.id`). Las tablas nuevas usan `private.is_clinic_staff_for(clinic_id)` para aislamiento.

### Supabase aplicado

Migración: `clinic_crm_messaging`.

| Tabla | Descripción |
|---|---|
| `public.clinic_conversations` | Un hilo por par clínica-paciente. Status (`bot`, `waiting_human`, `in_progress`, `resolved`, `escalated`), intent, asignación a staff, contador de no-leídos, último mensaje. |
| `public.clinic_chat_messages` | Mensajes individuales. Tipos: `in` (paciente), `out` (staff humano), `bot` (Muguerza Concierge), `system` (eventos de sistema). |

### Trigger

`private.update_conversation_on_message()` — al insertar mensaje, actualiza `last_message_at`, `last_message_preview` y suma a `unread_count` si es entrante.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types.ts` | `ClinicConversation`, `ClinicChatMessage`, `ClinicConversationStatus`, `ClinicConversationIntent`, `ClinicChatMessageType`. |
| `src/api/clinic.ts` | `listConversations`, `listConversationMessages`, `sendConversationMessage`, `updateConversationStatus`, `markConversationRead`. |
| `src/components/ClinicDesktop.tsx` | Función `Bandeja` completa (reemplaza placeholder). Carga `conversations` a nivel shell para el badge del nav y realtime sync. |

### UX

- Mismo patrón visual que `DesktopInbox` del doctor: 320px lista + chat al lado derecho.
- Lista con filtros por estado (Todas, Espera humano, En atención, Bot, Resueltas).
- Búsqueda por nombre o `patient_id`.
- Badge rojo en sidebar con conversaciones esperando humano.
- Auto-marca como leído al abrir conversación.
- Acción **"Tomar caso"** — promueve de `bot`/`waiting_human` a `in_progress` y se auto-asigna al staff.
- Acción **"Marcar resuelta"** — cierra el hilo.
- Al enviar mensaje desde un caso `waiting_human`/`bot`, auto-promueve a `in_progress`.
- Diferenciación visual de mensajes bot (estilo dashed con etiqueta 🤖 Bot Concierge), salientes (brand), entrantes (surface).

### Datos demo

5 conversaciones para "CEI Saltillo Centro" con los 5 estados representados (`waiting_human` x2, `bot`, `in_progress`, `resolved`) y 16 mensajes totales con intents reales (preauth, appointment, result, escalation, follow_up).

### Backend pendiente (gap crítico para producción)

| # | Pendiente | Por qué importa |
|---|---|---|
| 1 | **Integración WhatsApp Business API** | Hoy las conversaciones se siembran a mano. Se necesita webhook (Edge Function) que reciba `messages.upsert` de WhatsApp Cloud API o Twilio y los inserte en `clinic_chat_messages` con `t='in'`. |
| 2 | **Outbound a WhatsApp** | `sendConversationMessage` hoy solo escribe a BD. Falta llamar al API de WhatsApp Cloud para que el mensaje llegue al paciente real. |
| 3 | **Bot Concierge** | El bot debe ser un servicio externo (Dialogflow / Rasa / agente LLM) que escuche el webhook, responda en `t='bot'` y dispare handoff cambiando `status='waiting_human'`. |
| 4 | **Routing por intent** | El bot debería etiquetar `intent` automáticamente y rutear: `escalation` → notificación push a coordinador clínico; `preauth` → asignar al equipo de aseguradoras. |
| 5 | **Templates aprobados por WhatsApp** | Para iniciar conversaciones (recordatorios de cita, resultados listos) se requieren templates HSM aprobados por Meta. Hay que catalogar y enviarlos. |
| 6 | **Asignación automática y SLA** | Conversaciones `waiting_human` deberían tener timer; si nadie las toma en X minutos, alertar al admin. Tabla `clinic_sla_breaches`. |
| 7 | **Notificaciones browser/desktop** | Hoy realtime actualiza el badge, pero no notifica al usuario. Falta `Notification.requestPermission()` + push en eventos críticos. |
| 8 | **Adjuntos** | Los pacientes envían fotos (receta, resultado anterior). Falta storage bucket `clinic_chat_attachments` (privado, signed URLs) y soporte en mensajes (`attachments jsonb`). |
| 9 | **Plantillas rápidas** | Botones de "respuesta rápida" para mensajes comunes ("¿A qué hora es tu cita?", "Por favor envíanos tu orden médica"). |
| 10 | **Logs/auditoría** | Tabla `clinic_conversation_audit` que registre cada cambio de status y asignación con `actor_staff_id`, `timestamp`. |
| 11 | **Multi-asignación / handoff entre staff** | Hoy `assigned_to` es uno solo. En casos complejos, el coordinador transfiere al equipo de aseguradoras. Falta historial de transferencias. |
| 12 | **Vinculación bidireccional con `service_appointments`** | El campo `related_appointment_id` existe pero la UI no lo muestra ni lo crea automáticamente cuando la conversación trata de una cita específica. |

---

## 🟡 Huecos generales del módulo Clínicas Ambulatorias — mayo 2026

Análisis post-implementación inicial. Estos son los gaps que separan al módulo de un MVP funcional listo para piloto en una clínica real.

### Datos / Modelo

1. **`clinic_patients`** — No hay tabla de pacientes propia de la clínica. `service_appointments.patient_id` es `text` sin FK fuerte. El staff de clínica **no puede leer `public.patients`** (RLS bloqueado por `private.can_access_patient` que valida ownership por doctor). Resultado: la UI muestra el `patient_id` en lugar del nombre del paciente en agenda, pre-auth y resultados. **Decisión arquitectónica pendiente:** ¿compartir la tabla `patients` con RLS extendida, o crear `clinic_patients` denormalizada vinculada por `external_patient_ref`?
2. **Catálogo de aseguradoras** — `insurer` es free-text. Debería ser tabla `insurers` con (id, name, logo, contact_phone, contact_email, sla_days, contract_status) para alimentar dashboards de aseguradoras correctamente.
3. **Catálogo de servicios** — `clinic_services.service_type` tiene CHECK pero no hay tabla con metadata adicional por tipo (requisitos previos del paciente, ayuno, suspensión de medicamentos, duración promedio real, costo lista, costo aseguradora). El UI no puede mostrar "Prepárate para tu infusión" al paciente.
4. **`clinic_capacity_slots`** — No existe modelo de capacidad operativa: cuántas sillas de infusión, cuántas salas de imagen, cuántos turnos por día. Sin esto no se pueden detectar conflictos de agenda ni calcular ocupación.
5. **Insurer pre-auth SLA** — `pre_auth_requests` no tiene `sla_due_at`. No se detectan automáticamente vencimientos (la aseguradora prometió respuesta en 72h y van 96h).
6. **Hub-spoke link operativo** — `clinics.hub_clinic_id` existe pero no hay flujo real. Un escalamiento en spoke debería notificar al hub. Falta tabla `clinic_transfers` con (from_clinic, to_clinic, patient_id, transfer_type, ambulance_eta, accepted_by).

### Flujos faltantes

7. **Creación de nueva cita desde UI** — No hay "Nueva cita" button ni modal. Todo se inserta vía SQL/API directo.
8. **Check-in del paciente** — Botón existe (avanza estado), pero falta capturar firma del paciente, validar identidad, registrar acompañante, confirmar consentimiento informado para procedimientos invasivos.
9. **Captura de resultados** — Insertar resultados pasa por SQL directo. Falta UI para subir PDF/imagen, llenar formulario de nota de procedimiento, marcar como crítico.
10. **Creación de escalamiento** — Solo se visualizan, no se crean desde UI. Falta modal de "Activar escalamiento" con (motivo, destino, estabilidad, notas, alertar a hub).
11. **Cobro / Co-pago** — No hay módulo financiero. Servicios ambulatorios casi siempre tienen co-pago al ingreso. Falta `clinic_payments` y UI de check-out.
12. **Reagendamiento** — No hay flujo de cambio de fecha/hora con notificación al paciente.
13. **Cancelación con motivo** — Cancelar es un click, no se captura motivo ni se libera el slot para otros.

### Producto / Acoplamiento a la estrategia ambulatoria del PDF

14. **NPS post-servicio** — La estrategia menciona medir experiencia. Falta encuesta automática vía WhatsApp post-completed.
15. **Conversión hub→spoke** — KPI estratégico (paciente del hospital Muguerza derivado a CEI ambulatoria). Métrica no existe.
16. **Tiempo de espera** — La promesa ambulatoria es eficiencia. No se mide `checked_in → in_progress` ni `in_progress → completed`.
17. **Ocupación de capacidad** — Sin tabla de capacidad, no se puede calcular el KPI de utilización (clave para decidir abrir spoke nuevo).
18. **Costos por servicio** — Para ver rentabilidad real por tipo de servicio, falta `costo` por `clinic_service`. Hoy "Rendimiento" cuenta volumen, no margen.

### Seguridad operativa pre-producción

(Documentado arriba en la sección anterior — Codex.)

19. Audit log de mutaciones — pendiente.
20. MFA obligatorio para clinic_staff — pendiente.
21. Rate limiting en mutaciones — pendiente.
22. Cifrado de notas clínicas at-rest — pendiente.
23. Pen test del aislamiento inter-clínica — pendiente.
24. NOM-024 / clasificación de PHI — pendiente.

### Validación realizada

- `tsc --noEmit` pasa limpio.
- 5 conversaciones demo + 16 mensajes en BD para probar UI.
- Realtime subscriptions activas: `clinic_conversations` y `clinic_chat_messages` (filtrado por conversation seleccionada).
- RLS verificado con políticas `is_clinic_staff_for(clinic_id)`.

---

## ✅ Capacidad Operativa / Infraestructura — mayo 2026

**Estado:** Implementado — modelo de capacidad, asignación automática por trigger, UI con mapa visual, KPI de ocupación en Panel del día. Producto operable a nivel piloto.
**Motor:** M1 (eficiencia operativa) · **Costo real:** $0 · **IA requerida:** No

### Contexto

La estrategia ambulatoria del PDF define que la rentabilidad depende de la utilización de infraestructura: sillas de infusión, salas de imagen, estaciones de laboratorio. Sin un modelo explícito de capacidad, no se podía detectar conflictos de agenda ni asignar pacientes a recursos físicos. Este módulo cierra ese gap.

### Supabase aplicado

Migraciones: `clinic_capacity_resources`, `clinic_drop_patient_fk`.

| Tabla | Descripción |
|---|---|
| `public.clinic_resources` | Catálogo de infraestructura física: sillas, estaciones, salas, quirófanos, consultorios. Tipo, nombre, código corto, posición, capacidad. |
| `public.clinic_resource_assignments` | Asignación activa de un recurso a una cita. Tiempos `started_at` / `expected_end_at` / `ended_at`. Solo una asignación activa por recurso (índice único parcial). |

### Trigger

`private.manage_resource_on_appointment_change()` se dispara en INSERT/UPDATE de `service_appointments`:

- **Cuando status → `in_progress`:** mapea `service_type` a `resource_type` y asigna automáticamente la primera silla/sala libre del tipo correspondiente. Calcula `expected_end_at = now() + duration_min` del servicio.
- **Cuando status → `completed`/`cancelled`/`no_show`/`escalated`:** libera la asignación activa (`status = 'freed'`, `ended_at = now()`).
- Idempotente: no duplica asignaciones si la cita ya tiene una activa.

Mapeo:
| service_type | resource_type |
|---|---|
| infusion | infusion_chair |
| lab | lab_station |
| imaging | imaging_room |
| surgery | surgery_room |
| consult | consult_room |

### Decisión arquitectónica: eliminación del FK a `public.patients`

Las migraciones eliminaron `service_appointments_patient_id_fkey`, `pre_auth_requests_patient_id_fkey` y `service_results_patient_id_fkey`. Razón: el módulo de clínicas no comparte la tabla `patients` (que pertenece al módulo de consultorio con su propia RLS). `patient_id` es ahora una referencia de texto libre, a ser reemplazada por una tabla `clinic_patients` propia. Documentado como gap (#1 de Datos / Modelo).

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types.ts` | `ClinicResource`, `ClinicResourceAssignment`, `ClinicResourceType`. |
| `src/api/clinic.ts` | `listResources`, `listActiveAssignments`, `manualAssignResource`, `freeResource`. |
| `src/components/ClinicDesktop.tsx` | Componente `Infraestructura` con mapa visual por tipo. Panel del día con mini-mapa compacto y KPI de ocupación. Agenda muestra columna "Recurso" con el código de la silla/sala asignada. Realtime subscription a `clinic_resource_assignments`. Nuevo screen `infraestructura` en el sidebar. |

### UX

**Vista Infraestructura:**
- Resumen superior: 5 cards con `ocupadas/total` y barra de utilización por tipo (verde <50%, ámbar 50-79%, rojo ≥80%).
- Mapa por tipo: cada silla/sala como card con iniciales del paciente, servicio, tiempo restante. Estado visual: libre (gris), ocupada (brand), sobretiempo (rojo).
- Botón **Liberar** manual por recurso (cubre el caso de paciente que se retira sin completar el flujo en sistema).

**Panel del día:**
- Stat de ocupación reemplaza "Completadas" (que ya estaba en otras vistas).
- Mini-mapa compacto: cada recurso como chip con su código corto (I-1, LAB-A, IMG-RX, QX-1, C-1). Ocupado = brand fill, libre = surface alt.
- Botón "Ver detalle →" abre la sección completa de Infraestructura.

**Agenda:**
- Nueva columna "Recurso" muestra el código corto del recurso asignado (vacío si la cita no está en progreso o si no había recursos libres al momento del check-in).

### Datos demo en CEI Saltillo Centro

**13 recursos:**
- 5 sillas de infusión (Silla 1–5)
- 3 estaciones de laboratorio (Estación A, B, C)
- 2 salas de imagen (Rayos X, Ultrasonido)
- 1 quirófano ambulatorio
- 2 consultorios

**12 citas demo** distribuidas en `in_progress`, `scheduled`, `checked_in`, `completed`. El trigger automáticamente asignó:
- Silla 1 → PAC-AMB-001 (quimioterapia)
- Silla 2 → PAC-AMB-006 (hierro)
- Silla 3 → PAC-AMB-007 (quimioterapia)
- Estación A → PAC-AMB-004 (lab)
- Sala Rayos X → PAC-AMB-008 (imagen)
- Quirófano 1 → PAC-AMB-009 (cirugía)

Sillas 4 y 5, estaciones B y C, ultrasonido y consultorios quedan libres. El mapa refleja esto en tiempo real.

### Gaps para sacar al mercado

| # | Pendiente | Por qué importa |
|---|---|---|
| 1 | **Pre-asignación al agendar** | Hoy se asigna al `in_progress`. Producción real exige reservar el recurso al crear la cita (sino dos pacientes coinciden en horario). Agregar `service_appointments.planned_resource_id` y validar disponibilidad en INSERT vía trigger. |
| 2 | **Validación de doble booking** | Sin pre-asignación, dos `scheduled` pueden coincidir en horario para un mismo recurso. Función `private.is_resource_available_at(resource_id, scheduled_at, duration_min)` antes de aceptar nueva cita. |
| 3 | **Horarios de operación por recurso** | Recursos no operan 24/7. Tabla `clinic_resource_schedules` con (dia_semana, hora_inicio, hora_fin) por recurso. La validación de disponibilidad debe respetarlo. |
| 4 | **Bloqueos de mantenimiento** | Tabla `clinic_resource_blocks` con (resource_id, blocked_from, blocked_to, reason) para limpieza, mantenimiento, calibración. |
| 5 | **Reasignación manual con motivo** | `manualAssignResource` existe en API pero no tiene UI. Falta modal "Mover paciente a otra silla" con captura de motivo (paciente prefiere ventana, equipo descompuesto, etc.). |
| 6 | **Sobretiempo: notificación al staff** | Hoy se muestra "Sobretiempo" en rojo, pero nadie se entera si no abre la pantalla. Falta push notification cuando `now() > expected_end_at` para citas activas. |
| 7 | **Métricas de ocupación históricas** | `clinic_resource_assignments` tiene `ended_at` y `started_at`. Falta vista agregada `clinic_capacity_metrics_daily` con utilización %, tiempo promedio, sobretiempo % por día/recurso/tipo. Esto alimenta el KPI estratégico de "abrir spoke nuevo cuando ocupación >85%". |
| 8 | **Auto-promoción de cola** | Cuando se libera silla, la siguiente cita `scheduled` del mismo tipo de servicio debería entrar automáticamente a `in_progress` si el paciente está en `checked_in`. Hoy es manual. Trigger adicional o RPC. |
| 9 | **Asignación inteligente por características** | Algunos servicios requieren equipo específico (silla con bomba, sala con tomógrafo vs RX simple). Falta `clinic_services.required_capabilities jsonb` y `clinic_resources.capabilities jsonb`. El trigger debería matchear capabilities. |
| 10 | **Capacidad para acompañante / cuidador** | En quimioterapia, los pacientes vienen con un acompañante. Falta modelar capacidad de sillas adicionales para acompañantes (campo `companion_capacity int` en `clinic_resources`). |
| 11 | **Movilización entre recursos durante el servicio** | Una infusión puede iniciar en silla 1 y mover a silla 3 si el paciente lo solicita. Hoy solo hay 1 asignación activa por cita. Falta historial de asignaciones por cita (tabla ya soporta esto, falta UI). |
| 12 | **Conflicto staff-recurso** | Una sala de imagen requiere técnico radiólogo disponible. Modelo de capacidad no considera staff por recurso. Falta `clinic_staff_assignments` (qué staff trabaja qué turno y qué recurso). |
| 13 | **Mantenimiento programado y depreciación** | Para auditoría operativa: fecha de adquisición, fecha de último mantenimiento, vida útil estimada por recurso. Tabla `clinic_resource_lifecycle`. |
| 14 | **Capacidad agregada hub-spoke** | El dashboard de director debería mostrar ocupación agregada de todas las clínicas. Falta vista `clinic_network_capacity` que agregue por organización. |
| 15 | **Costo operativo por silla/hora** | Para calcular margen real: cuánto cuesta tener una silla operativa una hora (renta + insumos + staff + amortización). Tabla `clinic_resource_costs`. |

### Validación realizada

- `tsc --noEmit` pasa limpio.
- `npm run build` pasa.
- Trigger probado: 12 inserts simultáneos de citas resultaron en 6 asignaciones automáticas correctas (3 sillas + 1 lab + 1 imagen + 1 quirófano), todas con `expected_end_at` calculado correctamente.
- Índice único parcial `idx_one_active_per_resource` previene doble asignación.
- Realtime actualiza el mapa cuando otro staff cambia estado de cita.
- RLS verificado: solo `clinic_staff` de la clínica puede ver/modificar sus recursos.

---

## 🟡 Agendamiento automatizado vía WhatsApp — pendiente

**Motor:** M1 · **Bloqueante:** integración WhatsApp Business API + bot Concierge externo.

### Por qué se documenta como gap

El usuario pidió que el agendamiento se haga principalmente vía WhatsApp (paciente conversa con bot Concierge → bot toma datos → bot crea la cita directamente en `service_appointments`). Por eso no se implementó un formulario de "Nueva cita" en la UI del staff: en producción ese flujo será residual, solo para casos donde el bot no pudo cerrar la conversación.

### Lo que falta para que funcione

1. **Edge Function `whatsapp-webhook`** — recibe payloads de WhatsApp Cloud API (o Twilio), parsea mensaje, lo deposita en `clinic_chat_messages` con `t='in'`.
2. **Bot Concierge externo** — servicio que escucha el webhook, conversa con el paciente para capturar (servicio deseado, fecha preferida, aseguradora, orden médica adjunta). Puede ser Dialogflow, Rasa, o un agente LLM con tool use.
3. **Función `book_appointment` expuesta al bot** — RPC en Supabase que recibe `{clinic_id, patient_id, service_type, preferred_date, insurer}` y:
   - Llama a `is_resource_available_at` (gap #2 de Capacidad) para encontrar slot.
   - Si encuentra slot, inserta en `service_appointments` con `status='scheduled'` y `planned_resource_id` reservado.
   - Si no, devuelve alternativas (siguiente día con disponibilidad).
4. **Templates aprobados por Meta** — para confirmaciones de cita, recordatorios 24h antes, instrucciones de preparación.
5. **Captura de orden médica** — el paciente envía foto de la orden por WhatsApp; el bot la sube a Storage privado y la asocia a `service_appointments.order_doc_path`.
6. **Detección de intent ambiguo** — cuando el bot no puede completar (caso atípico), cambia `clinic_conversations.status='waiting_human'` y rutea al equipo de la clínica (ya implementado en CRM).

### Implicación de seguridad

El bot Concierge va a tener acceso de escritura a `service_appointments` y `clinic_chat_messages`. Debe operar con un service account dedicado (no JWT de usuario), con RLS específica que limite operaciones a:
- INSERT en `service_appointments` solo con `status='scheduled'`.
- INSERT en `clinic_chat_messages` solo con `t='bot'`.
- UPDATE en `clinic_conversations.status` solo para promover a `waiting_human`.

Documentar en el hardening de Codex (sección de seguridad del módulo Clínicas Ambulatorias).
- No requiere build.
