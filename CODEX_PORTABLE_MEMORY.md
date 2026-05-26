# Codex Portable Memory - Muguerza Connect

Este archivo sirve para pasar contexto a otro chat, otra cuenta o otra computadora.
Debe leerse antes de continuar trabajo en este repo.

## Proyecto

Repo local: `muguerza-connect-desktop`

Muguerza Connect es una app Vite + React + TypeScript conectada a Supabase.
No es solo un prototipo visual: maneja roles de doctor y secretaria, pacientes,
agenda, documentos, laboratorios, dashboards, Storage, Realtime y Edge Functions.

El frontend vive principalmente en `src/`.
La base/documentacion Supabase vive en `supabase/`.
La bitacora de features y estado real vive en `FUTURAS_IMPLEMENTACIONES.md`.
Las reglas para Claude viven en `CLAUDE.md`.
Los handoffs importantes viven en `handoffs/`.
Las revisiones post-Claude viven en `reviews/`.

## Orden de lectura recomendado

Antes de editar o planear:

1. `CLAUDE.md`
2. `README.md`
3. `FUTURAS_IMPLEMENTACIONES.md`
4. `reviews/README.md`
5. Archivos relevantes en `handoffs/`
6. Archivos relevantes en `reviews/`
7. Codigo real en `src/` y SQL real en `supabase/`

No confiar ciegamente en README si contradice el codigo vivo. Verificar siempre.

## Division de trabajo Codex / Claude

Modelo de trabajo preferido:

- Claude Opus: ideacion de producto, exploracion y propuestas de alto nivel.
- Codex: logica robusta, Supabase, seguridad, schema, RLS, indices,
  validacion, documentacion tecnica y prompts/handoffs precisos.
- Claude Sonnet: implementacion enfocada despues de que Codex define los
  constraints y el alcance.

Claude puede implementar UI/features, pero Codex debe revisar:

- Logica robusta.
- Seguridad.
- Supabase/RLS.
- Contratos de datos.
- Documentacion tecnica.
- Riesgos de evolucion de MVP a producto final.

## Reglas criticas

- No inventar schema de Supabase. Verificarlo en codigo, SQL o proyecto
  conectado.
- No cambiar `patients.id` ni `patient_id` a UUID. En la DB real son `text`.
- No usar policies demo/permisivas como diseno de produccion.
- No exponer datos clinicos fuera del rol activo.
- No crear UI bonita sin fuente real de datos.
- No dejar features medio conectadas.
- No hacer refactors amplios al implementar una feature puntual.
- No sobrescribir cambios de usuario/Codex sin revisar el archivo actual.
- Despues de trabajo importante, actualizar `FUTURAS_IMPLEMENTACIONES.md`.

## Supabase

Proyecto conocido: `egehyxbtxjnlkwvlndgr`

Supabase se usa para:

- Auth.
- Postgres.
- Storage.
- Realtime.
- Edge Functions.

Para tareas Supabase:

1. Verificar schema vivo primero.
2. Revisar grants/RLS/policies antes de cambiar.
3. Aplicar el cambio minimo.
4. Verificar con consultas o Advisor.
5. Documentar el estado final y riesgos.

Helpers importantes ya usados:

- `private.current_doctor_id()`
- `private.current_secretary_id()`
- `private.is_doctor_owner(...)`
- `private.is_secretary_for_doctor(...)`
- `private.can_access_doctor(...)`
- `private.can_access_patient(...)`

Estas funciones viven en schema `private`, no expuesto, y ayudan a evitar RLS
recursivo.

## RLS y seguridad

Se aplicaron fases de hardening RLS:

- Phase 1: identidad, F-14, F-16 y vistas de metricas.
- Phase 2A: pacientes y agenda.
- Phase 2B: labs, documentos e historial.
- Phase 2C: alertas, inbox, chats y pendientes.

Patron de acceso:

- Doctor accede a sus propios datos.
- Secretaria accede a doctores/pacientes vinculados por `secretary_doctors`.
- `anon` no debe tener acceso directo a tablas clinicas.
- Los flujos publicos deben ir por RPCs especificos, no acceso directo a tabla.

`doctor_metrics_monthly` y `specialty_benchmarks_monthly` deben conservar
`security_invoker=true`.

Antes de nuevas features Supabase, resolver primero bloqueos de Supabase
Advisor si el usuario lo pide como obligatorio.

## Storage y documentos

Supabase Storage es privado para documentos clinicos.

No asumir URLs publicas. El patron correcto es:

- Guardar metadata de bucket/storage_path.
- Generar signed URLs cuando se necesita leer/ver/procesar.
- Para extraccion server-side, pasar signed URLs a la funcion.

## Edge Function extract-labs

Ruta principal:

Secretaria sube archivo -> Supabase Storage -> signed URL -> Edge Function
`extract-labs` -> tabla `labs` -> doctor ve resultados en el expediente.

La funcion `extract-labs` esta pensada con `verify_jwt: true`.
Un 401 anonimo no prueba que este rota; hay que probar con flujo autenticado o
desde la app.

Para reactivar/deployar extraccion directa:

1. Verificar `supabase/lab_extraction_patch.sql`.
2. Verificar buckets privados y policies.
3. Configurar secrets de proveedor IA/OCR si aplica.
4. Deployar `extract-labs`.
5. Probar subiendo archivo marcado como resultado de laboratorio.

## F-14 / Dashboard practica

La feature F-14/F-14+6 agrega metricas financieras y operativas.

Columnas importantes en `consultations`:

- `patient_id text`
- `doctor_id uuid`
- `agenda_slot_id uuid`
- `type`
- `fee`
- `payment_method`
- `insurer`
- `consultation_type_id`
- `consultation_type_name`
- `fee_overridden`

No insertar registros financieros con `fee = 0` salvo que sea flujo intencional
de cortesia/gratis.

La secretaria cierra consultas y selecciona metodo de pago:

- `efectivo`
- `tarjeta`
- `aseguradora`
- `cortesia`

Si es aseguradora, debe conservarse `insurer`.

## F-16 / Pre-cita

La base de F-16 usa tokens seguros.

Patron correcto:

- Logica privilegiada privada.
- Wrappers publicos `SECURITY INVOKER`.
- Generacion autenticada de token.
- Lookup/submission publico por token.
- No dar acceso directo anonimo a tablas sensibles.

Funciones/objetos relevantes:

- `precita_tokens`
- `generate_precita_token`
- `get_precita_by_token`
- `submit_precita`

## UI y producto

Muguerza Connect es producto clinico operacional, no landing page.

UI esperada:

- Densa, clara, calmada y eficiente.
- Reusar patrones existentes.
- Evitar redisenos amplios si el usuario pide un fix puntual.
- Evitar UI decorativa o tutoriales dentro de la app.
- Si se toca secretaria, respetar el lenguaje visual del portal doctor.
- Para iconos, usar `src/data/icons.tsx` y el lenguaje SVG existente, no emojis.
- Para dark mode secretaria, basarse en tokens y comportamiento del doctor portal.

## Demo mac shell

Existe flag:

`VITE_DEMO_MAC_SHELL=false`

El marco visual tipo macOS era temporal para demo. Se deshabilito sin borrar
assets. Si se necesita demo, puede reactivarse con `true` y reiniciar Vite.

## Validacion local

Comandos base:

```powershell
npm install
npm run dev
npm run build
```

En este entorno Windows, si `npm run build` falla por un problema tipo
`spawn EPERM`, `npx.cmd tsc -b` fue una validacion TypeScript mas confiable.

Comando util:

```powershell
npx.cmd tsc -b
```

## Setup en computadora nueva

Instalar:

- Node.js LTS.
- Git recomendado.
- VS Code recomendado.
- Supabase CLI solo si se van a desplegar funciones/migraciones.

Despues de copiar el repo sin `node_modules`:

```powershell
npm install
npm run dev
```

Verificar que exista `.env.local`:

```env
VITE_SUPABASE_URL=https://egehyxbtxjnlkwvlndgr.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DEMO_MAC_SHELL=false
```

## Instruccion para otro Codex/Claude

Cuando otro agente tome este proyecto, usar este prompt:

```text
Primero lee CODEX_PORTABLE_MEMORY.md, CLAUDE.md, README.md y
FUTURAS_IMPLEMENTACIONES.md. Despues inspecciona el codigo y SQL real antes de
proponer cambios. No inventes schema de Supabase. Si la tarea toca Supabase,
verifica schema/RLS/policies antes de editar. Mantén la division: Codex se
encarga de seguridad, Supabase, logica robusta y validacion; Claude/Sonnet puede
implementar UI/features solo con alcance claro. Al final documenta cambios en
FUTURAS_IMPLEMENTACIONES.md si el trabajo fue significativo.
```

