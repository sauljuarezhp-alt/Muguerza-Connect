# Muguerza Connect

Muguerza Connect es un portal clínico-operativo para el ecosistema CHRISTUS
Muguerza CEI. El objetivo actual no es una landing ni un prototipo desechable:
es avanzar hacia una aplicación real de trabajo diario para doctores y
secretarias, con seguridad, trazabilidad, separación de roles y datos clínicos
confiables.

La app actual es **Vite + React + TypeScript + Supabase**. Corre como portal
desktop web, con flujos para doctor y secretaria, expediente de pacientes,
agenda, documentos, resultados de laboratorio, pre-cita pública, métricas de
práctica y hardening progresivo de Supabase/RLS.

## Estado Actual

Implementado y documentado en el ledger:

- Portal de doctor con dashboard, pacientes, expediente, inbox, agenda,
  aseguradoras, órdenes, perfil y preferencias.
- Portal de secretaria con administración de pacientes, agenda, documentos,
  laboratorios manuales, pre-cita y pendientes.
- Autenticación con Supabase Auth y detección de rol por `doctors.user_id` o
  `secretaries.user_id`.
- RLS por rol de aplicación para doctores y secretarias vinculadas.
- Storage privado para documentos clínicos con signed URLs.
- Historial clínico estructurado en `patient_history` con ligas a citas,
  consultas, pre-citas, documentos y labs.
- Pre-consulta automática para el doctor antes de la siguiente cita.
- Pre-cita pública por token de un solo uso, sin login del paciente.
- Dashboard de práctica con métricas operativas/financieras y tipos de consulta.
- Extracción de laboratorios desde PDF/imagen mediante Edge Function híbrida:
  Azure Document Intelligence, Azure OpenAI cuando exista, y Claude como
  fallback.

La fuente de verdad funcional es:

```text
FUTURAS_IMPLEMENTACIONES.md
```

Ese archivo dice qué existe, qué fue validado, qué falta y qué decisiones de
Supabase/seguridad ya se tomaron. El README es orientación; el ledger manda.

## Objetivo Del Producto

Muguerza Connect busca concentrar el trabajo médico-administrativo alrededor de
un paciente:

- Reducir tiempo administrativo del doctor.
- Mejorar la preparación antes de consulta.
- Dar continuidad entre secretaria, doctor y paciente.
- Mantener expediente, documentos, labs, pre-citas, agenda y cobros conectados.
- Crear una base segura para crecer hacia IA clínica, recetas, referidos,
  co-management, WhatsApp y flujos hospitalarios reales.

El producto debe sentirse como una herramienta operativa de salud: densa,
clara, calmada y repetible. No se debe construir UI sin fuente de datos real ni
dejar flujos medio conectados.

## Stack

- React 18
- TypeScript
- Vite
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Recharts para visualizaciones
- Azure Document Intelligence como OCR/layout recomendado
- Azure OpenAI como ruta posible de extracción estructurada
- Claude/Anthropic como fallback actual para extracción de labs

## Cómo Correr Localmente

Instalar dependencias:

```bash
npm install
```

Servidor de desarrollo:

```bash
npm run dev
```

Build:

```bash
npm.cmd run build
```

Preview:

```bash
npm run preview
```

Variables esperadas en `.env.local`:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_DEMO_MAC_SHELL=false
```

`VITE_DEMO_MAC_SHELL` conserva un marco visual tipo macOS usado para demos. El
producto normal corre a pantalla completa con `false`. Se mantiene por ahora
como recurso temporal de presentación, no como experiencia final.

## Estructura Principal

```text
src/
  App.tsx                         # Auth, ruta pública de pre-cita y rol principal
  main.tsx                        # Entry React
  api/                            # Frontera de datos contra Supabase
    agenda.ts
    alerts.ts
    chats.ts
    consultationTypes.ts
    doctor.ts
    inbox.ts
    index.ts
    labs.ts
    metrics.ts
    patients.ts
    pending.ts
    precita.ts
    preconsulta.ts
    secretary.ts
  components/
    MCDesktop.tsx                 # Portal del doctor
    SecretaryDesktop.tsx          # Portal de secretaria
    DesktopDashboard.tsx
    DesktopPracticeDashboard.tsx
    DesktopPatients.tsx
    DesktopPatient.tsx
    DesktopInbox.tsx
    DesktopAgenda.tsx
    DesktopAseguradoras.tsx
    CloseConsultationModal.tsx
    ConsultationTypesPanel.tsx
    PatientStoryView.tsx
    PrecitaForm.tsx
    PrecitaSummaryCard.tsx
    PreconsultaCard.tsx
    NewOrderModal.tsx
    ProfilePanel.tsx
    LoginScreen.tsx
    DocumentViewer.tsx
  context/
    ThemeContext.tsx
  data/
    analitos.ts                   # Catálogo local para captura manual de labs
    consultationTemplates.ts      # Plantillas de tipos de consulta
    icons.tsx
  lib/
    dates.ts
    supabase.ts
  styles.css
  shell.css                       # Shell demo temporal
  types.ts

supabase/
  schema.sql                      # Schema demo; no aplicar a DB real sin revisar
  seed.sql                        # Datos demo
  lab_extraction_patch.sql        # Patch histórico de labs
  functions/
    extract-labs/
      index.ts                    # Edge Function híbrida para extracción de labs

handoffs/                         # Contexto técnico de trabajos previos
reviews/                          # Revisiones post-implementación
AGENTS.md                         # Reglas de trabajo para Codex
CLAUDE.md                         # Reglas de trabajo para Claude
FUTURAS_IMPLEMENTACIONES.md       # Ledger vivo del producto
```

## Roles De Usuario

La app detecta el rol después del login:

1. Busca al usuario en `doctors.user_id`.
2. Si no existe, busca al usuario en `secretaries.user_id`.
3. Si es doctor, carga `MCDesktop`.
4. Si es secretaria, carga `SecretaryDesktop`.
5. Si no tiene rol, muestra estado de usuario sin rol asignado.

El modelo de permisos actual se apoya en RLS y helpers privados de Supabase para
validar doctor dueño, secretaria vinculada y acceso por paciente.

## Portal Del Doctor

El doctor trabaja desde `src/components/MCDesktop.tsx`.

Flujos principales:

- Dashboard clínico.
- Pre-consulta automática de la siguiente cita.
- Lista y búsqueda de pacientes.
- Expediente 360 del paciente.
- Estudios y resultados de laboratorio.
- Historial estructurado.
- Inbox por origen.
- Agenda.
- Aseguradoras.
- Nueva orden.
- Dashboard de práctica y métricas financieras.
- Configuración de tipos/precios de consulta.
- Perfil y preferencias visuales.

El expediente (`DesktopPatient.tsx`) concentra resumen, estudios, aseguradora,
comunicación, historial y modo paciente/storytelling.

## Portal De Secretaria

La secretaria trabaja desde `src/components/SecretaryDesktop.tsx`.

Flujos principales:

- Selección de doctor activo.
- Alta/edición de pacientes.
- Agenda y estados de cita.
- Generación de link de pre-cita.
- Visualización de respuestas de pre-cita.
- Subida y clasificación de documentos.
- Captura manual de laboratorios.
- Extracción automática de labs desde documentos tipo `Resultado de lab`.
- Cierre de consulta con tipo, monto y método de pago.
- Pendientes del equipo.

Las rutas de documentos deben pasar por `src/api/secretary.ts`, porque ahí se
mantiene metadata, signed URLs, limpieza de Storage e historial estructurado.

## Supabase Y Gobierno De Datos

Reglas importantes:

- No inventar schema. Verificar en código, SQL, ledger o Supabase conectado.
- `patients.id` y columnas relacionadas `patient_id` son `text` en la DB real.
- No cambiar `patient_id` a UUID.
- No insertar datos financieros con `fee = 0` salvo cortesía/intención explícita.
- No usar policies demo/permisivas como diseño final.
- No exponer más datos de paciente/doctor que los permitidos por rol.
- Preservar snapshots financieros históricos: monto, método de pago y tipo de
  consulta al cerrar cita.
- Para tablas públicas nuevas: RLS, policies explícitas, índices para rutas de
  consulta y documentación en `FUTURAS_IMPLEMENTACIONES.md`.

Tablas/vistas clave actuales:

- `doctors`
- `secretaries`
- `secretary_doctors`
- `patients`
- `agenda_slots`
- `consultations`
- `doctor_consultation_types`
- `doctor_metrics_monthly`
- `specialty_benchmarks_monthly`
- `precita_tokens`
- `labs`
- `patient_documents`
- `patient_history`
- `alerts`
- `inbox_items`
- `chat_messages`
- `pending_items`

Buckets:

- `estudios`
- `polizas`

Los buckets deben ser privados. El frontend usa signed URLs temporales.

## Edge Function `extract-labs`

Función:

```text
supabase/functions/extract-labs/index.ts
```

Flujo actual:

```text
Documento subido como Resultado de lab
  -> Storage privado
  -> patient_documents
  -> signed URL temporal
  -> extract-labs
  -> Azure Document Intelligence si está configurado
  -> Azure OpenAI si está configurado
  -> Claude como fallback
  -> rows en labs
  -> evento en patient_history
  -> realtime/refresh en expediente del doctor
```

Secrets soportados:

```bash
ANTHROPIC_API_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=...
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=...
AZURE_OPENAI_API_VERSION=2024-10-21
```

La función también usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, expuestos
por Supabase Edge Functions.

## Documentación Del Proyecto

Leer en este orden:

1. `AGENTS.md`: reglas operativas de Codex, seguridad, commits y roles.
2. `FUTURAS_IMPLEMENTACIONES.md`: estado real de features y decisiones.
3. `reviews/`: revisiones técnicas post-implementación.
4. `handoffs/`: contexto puntual de trabajos previos.
5. `README.md`: orientación general.

`README.md` no debe sustituir el ledger. Si cambia una feature real, actualizar
`FUTURAS_IMPLEMENTACIONES.md`.

## Flujo De Trabajo Codex / Claude

Modelo actual:

- **Saul** define objetivo de producto o feature.
- **Codex** actúa como arquitecto técnico: ciberseguridad, gobierno de datos,
  Supabase, RLS, Edge Functions seguras, schema, auditoría, validación,
  documentación, GitHub y handoffs.
- **Claude/Sonnet** actúa como dev de implementación acotada: UI, componentes,
  interacción y lógica local desde un prompt claro.
- **Codex** revisa después: seguridad, RLS/schema, integridad de datos,
  documentación, build, commit y push.

No se debe pedir a Claude/Sonnet que reinvente la arquitectura completa si el
alcance ya fue definido.

## Git Y Repositorio

Repositorio GitHub:

```text
sauljuarezhp-alt/Muguerza-Connect
```

Rama principal:

```text
main
```

Cadencia recomendada:

- Commit después de cada unidad lógica terminada.
- Push a GitHub después de cada commit en `main`.
- Checkpoint cada 30-60 minutos en sesiones largas si el código está estable.
- No subir trabajo roto a `main` salvo WIP explícito.

Ignorados importantes:

- `.env.local`
- `node_modules/`
- `dist/`
- `.claude/`
- `.vscode/`
- `*.tsbuildinfo`
- `supabase/.temp/`

## Validación

Build completo:

```bash
npm.cmd run build
```

TypeScript del config Vite:

```bash
npx.cmd tsc -p tsconfig.node.json
```

En algunos entornos Windows con sandbox puede fallar Vite/esbuild por permisos.
Si falla solo dentro del sandbox y pasa fuera, es problema de entorno, no
necesariamente de código.

## Deuda Técnica Conocida

No bloquea el desarrollo actual:

- Bundle principal grande: Vite avisa que el JS inicial supera 500 kB. Hay que
  aplicar code-splitting antes de una versión pública/producción.
- `src/shell.css` y `VITE_DEMO_MAC_SHELL`: conservar temporalmente para demos,
  retirar cuando ya no se necesite el marco macOS.
- Supabase pre-producción: activar leaked password protection, revisar Advisor
  Performance y completar índices de FKs activos.
- Historial/timeline: evolucionar hacia timeline por cita agrupando pre-cita,
  consulta, documentos, labs, órdenes y mensajes.
- Extracción de labs producción: pasar de IA directa a pipeline con jobs,
  estados, reintentos, confianza, revisión humana y auditoría completa.

## Roadmap Cercano

Ver `FUTURAS_IMPLEMENTACIONES.md` para el detalle vivo. Pendientes relevantes:

- F-2: receta/re-receta inteligente.
- F-10: referido interno entre especialidades.
- F-17: co-management entre especialistas.
- F-13: marketplace de slots cancelados.
- F-15: iPad/PWA para visita hospitalaria.
- F-1/F-7/F-8/F-5: IA clínica y WhatsApp, con presupuesto/seguridad adicional.
