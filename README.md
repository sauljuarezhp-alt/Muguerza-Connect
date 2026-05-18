# Muguerza Connect

Portal clinico desktop para el ecosistema digital de CHRISTUS Muguerza CEI.

El proyecto ya no es el prototipo HTML/JSX original. Actualmente es una app **Vite + React + TypeScript** conectada a **Supabase** para autenticacion, roles, datos clinicos, documentos, realtime y una Edge Function para extraccion automatica de resultados de laboratorio desde PDFs o imagenes.

## Que es

Muguerza Connect concentra el trabajo diario de un medico y su equipo de apoyo:

- Vista ejecutiva del medico con dashboard clinico.
- Expediente 360 de pacientes.
- Resultados de laboratorio historicos.
- Documentos clinicos y archivos de aseguradora.
- Inbox por origen: enfermeria, paciente, aseguradora y resultados.
- Agenda y pendientes.
- Portal de secretaria para administrar pacientes, agenda, documentos y resultados.
- Subida de PDFs de laboratorio con extraccion automatica de analitos.

El objetivo del prototipo actual es demostrar un flujo clinico convincente: una secretaria sube un PDF de laboratorio para un paciente, el sistema extrae valores como Glucosa, Hemoglobina o Creatinina, y el doctor los ve reflejados en la pestana de Estudios del paciente.

## Stack

- React 18
- TypeScript
- Vite
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions
- Anthropic Claude para extraccion inteligente de PDFs de laboratorio
- Azure Document Intelligence como ruta OCR/Layout recomendada
- Azure OpenAI como ruta de extraccion IA si se decide reemplazar Claude

## Como correr localmente

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
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

`VITE_DEMO_MAC_SHELL` controla el marco visual tipo macOS que se uso para demo. El valor normal es `false`, que muestra Muguerza Connect a pantalla completa. Para grabar un demo con ese marco, cambia temporalmente el valor a `true` y reinicia Vite.

El marco visual tipo macOS fue parte de la demostracion inicial del producto para presentar la app como si estuviera dentro de una computadora/VM. Ya no forma parte de la experiencia principal: esta deshabilitado por defecto y se conserva solo como recurso temporal para posibles grabaciones o demos. Si el producto avanza sin necesitar ese encuadre, se puede eliminar en una limpieza futura junto con el CSS asociado en `src/shell.css` y la bandera `VITE_DEMO_MAC_SHELL`.

## Estructura principal

```text
src/
  App.tsx                         # Autenticacion, deteccion de rol y shell principal
  main.tsx                        # Entry React
  api/                            # Capa de acceso a datos Supabase
    doctor.ts
    patients.ts
    labs.ts
    alerts.ts
    inbox.ts
    agenda.ts
    chats.ts
    pending.ts
    secretary.ts
    index.ts
  components/
    MCDesktop.tsx                 # Portal del doctor
    SecretaryDesktop.tsx          # Portal de secretaria
    DesktopDashboard.tsx
    DesktopPatients.tsx
    DesktopPatient.tsx            # Expediente 360 del paciente
    DesktopInbox.tsx
    DesktopAgenda.tsx
    DesktopAseguradoras.tsx
    NewOrderModal.tsx
    ProfilePanel.tsx
    LoginScreen.tsx
    DocumentViewer.tsx
  context/
    ThemeContext.tsx
  data/
    analitos.ts                   # Catalogo local de analitos para captura manual
    icons.tsx
  lib/
    supabase.ts
  types.ts

supabase/
  schema.sql                      # Schema demo completo
  seed.sql                        # Datos demo
  lab_extraction_patch.sql        # Patch no destructivo para la DB actual
  functions/
    extract-labs/
      index.ts                    # Edge Function hibrida: Azure DI/Azure OpenAI con fallback Claude
```

## Roles

La app detecta el rol despues del login con Supabase Auth.

1. Busca al usuario en `doctors.user_id`.
2. Si no existe, busca al usuario en `secretaries.user_id`.
3. Si es doctor, carga `MCDesktop`.
4. Si es secretaria, carga `SecretaryDesktop`.
5. Si no tiene rol, muestra un mensaje de usuario sin rol asignado.

Archivo principal: `src/App.tsx`.

## Portal del doctor

Componente principal: `src/components/MCDesktop.tsx`.

Incluye:

- Sidebar con navegacion.
- Dashboard.
- Pacientes.
- Inbox.
- Agenda.
- Aseguradoras.
- Nueva orden.
- Notificaciones.
- Busqueda global de pacientes.
- Perfil y preferencias.
- Realtime para pacientes, inbox y alertas.

### Expediente del paciente

Componente: `src/components/DesktopPatient.tsx`.

Tabs disponibles:

- Resumen.
- Estudios.
- Aseguradora.
- Comunicacion.
- Historial.

La pestana **Estudios** muestra:

- Archivos adjuntos de tipo `Estudio` o `Resultado de lab`.
- Resultados numericos desde la tabla `labs`.
- Valor, unidad, rango, valor previo, delta y direccion de tendencia.

Tambien escucha realtime de:

- `labs`
- `patient_documents`
- `patient_history`

Asi, cuando una secretaria sube un laboratorio y la extraccion termina, el doctor puede ver los datos sin tener que recargar manualmente el expediente.

## Portal de secretaria

Componente principal: `src/components/SecretaryDesktop.tsx`.

Incluye:

- Selector de doctor activo.
- Pacientes.
- Agenda.
- Documentos.
- Pendientes.

Desde **Documentos**, la secretaria puede:

- Seleccionar paciente.
- Subir archivo.
- Clasificar el documento como:
  - Poliza
  - Estudio
  - Resultado de lab
  - Receta
  - Consentimiento
  - Otro
- Capturar resultados de laboratorio manualmente con catalogo de analitos.
- Ver resultados ya registrados.

## Flujo actual de extraccion de laboratorio

El flujo completo actual es:

```text
Secretaria sube PDF o imagen
  -> selecciona "Resultado de lab"
  -> se guarda archivo en Supabase Storage, bucket estudios
  -> se crea registro en patient_documents
  -> se genera signed URL temporal
  -> se invoca Supabase Edge Function extract-labs
  -> Azure Document Intelligence lee OCR/Layout si esta configurado
  -> Azure OpenAI convierte el texto a JSON si esta configurado
  -> Claude se usa como fallback si Azure OpenAI no esta configurado o si falla Azure
  -> la funcion inserta/actualiza rows en labs
  -> se registra historial clinico si aplica
  -> portal del doctor recibe realtime y refresca Estudios
```

Archivos clave:

- `src/api/secretary.ts`
- `supabase/functions/extract-labs/index.ts`
- `src/api/labs.ts`
- `src/components/DesktopPatient.tsx`

### Contrato JSON esperado de extraccion

La funcion espera que el modelo devuelva un array JSON:

```json
[
  {
    "n": "Glucosa",
    "val": 112,
    "unit": "mg/dL",
    "range_": "70-99",
    "st": "hi",
    "dir": "flat"
  }
]
```

Campos:

- `n`: nombre del analito.
- `val`: valor numerico.
- `unit`: unidad.
- `range_`: rango de referencia.
- `st`: `ok`, `hi` o `lo`.
- `dir`: `up`, `down` o `flat`.

### Que se guarda en `labs`

Cada analito queda registrado con:

- `patient_id`
- `n`
- `val`
- `unit`
- `range_`
- `st`
- `dir`
- `prev`
- `delta`
- `pdf_path`
- `taken_at`

`pdf_path` permite saber de que archivo salio el analito.

## Configuracion de Supabase

Para una DB existente, ejecutar en Supabase SQL Editor:

```text
supabase/lab_extraction_patch.sql
```

Ese archivo es no destructivo: agrega tablas y columnas faltantes sin borrar datos.

Importante: no ejecutar `schema.sql` sobre una DB con datos reales si no se reviso antes, porque el schema demo contiene drops al inicio para reinicializar la base.

### Tablas principales

- `doctors`
- `secretaries`
- `secretary_doctors`
- `patients`
- `agenda_slots`
- `alerts`
- `labs`
- `inbox_items`
- `chat_messages`
- `pending_items`
- `patient_documents`
- `patient_history`

### Buckets

- `estudios`
- `polizas`

Ambos pueden ser privados. El front genera signed URLs temporales para lectura y para el analisis de documentos.

### Edge Function

Funcion:

```text
extract-labs
```

Deploy:

```bash
supabase functions deploy extract-labs
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

`ANTHROPIC_API_KEY` sigue siendo suficiente para el flujo anterior con Claude directo. Si tambien se configuran los secrets de Azure, la funcion intenta primero Azure Document Intelligence. Si existe Azure OpenAI, lo usa para generar el JSON; si no existe, usa Claude sobre el texto ya extraido por Azure Document Intelligence.

La funcion tambien usa:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Supabase los expone normalmente en el entorno de Edge Functions.

## Costos de IA

La extraccion puede usar Claude mediante `ANTHROPIC_API_KEY`, Azure Document Intelligence + Azure OpenAI, o un modo hibrido con Azure Document Intelligence + Claude.

Si consume tokens cada vez que se analiza un documento marcado como **Resultado de lab**. El costo depende del tamano del PDF/imagen, el contenido enviado y el JSON generado.

Para prototipo, esto es deseable porque la experiencia es mas impresionante y tolera formatos variables. Para produccion a gran escala, Claude no deberia ser la unica primera linea de extraccion.

## Ruta Azure: Document Intelligence + Azure OpenAI

Esta es la ruta recomendada si se quiere usar el ecosistema Azure:

```text
PDF subido
  -> Supabase Storage
  -> signed URL temporal
  -> Edge Function extract-labs
  -> Azure Document Intelligence lee PDF/OCR/Layout
  -> texto y tablas extraidas
  -> Azure OpenAI convierte texto a JSON de analitos
  -> insert/update en labs
  -> realtime hacia portal del doctor
```

La idea es separar dos responsabilidades:

- **Azure Document Intelligence**: leer PDFs, OCR, layout, tablas y texto.
- **Azure OpenAI**: interpretar el texto extraido y devolver JSON estructurado de analitos.

No conviene saltar directo a Azure OpenAI para todo si el PDF viene escaneado o tabular. Primero se debe obtener texto limpio y estructura.

### Azure Document Intelligence

Recurso esperado en Azure:

```text
Azure AI Document Intelligence
```

Modelo recomendado para empezar:

```text
prebuilt-read
```

Tambien se puede evaluar:

```text
prebuilt-layout
```

`prebuilt-read` sirve para extraer texto. `prebuilt-layout` puede ser mejor cuando el laboratorio viene en tablas y se necesita preservar estructura.

Secrets esperados en Supabase Edge Functions:

```bash
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://TU-RECURSO.cognitiveservices.azure.com
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read
```

`AZURE_DOCUMENT_INTELLIGENCE_MODEL` puede omitirse si la funcion usa `prebuilt-read` como default.

Flujo REST esperado:

```http
POST {endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30
Ocp-Apim-Subscription-Key: {key}
Content-Type: application/pdf

<PDF bytes>
```

Azure responde `202 Accepted` con header:

```text
operation-location
```

Luego se hace polling:

```http
GET {operation-location}
Ocp-Apim-Subscription-Key: {key}
```

Hasta que `status` sea:

```text
succeeded
```

El texto principal normalmente se toma desde:

```text
analyzeResult.content
```

Ese texto es el input para el parser o para Azure OpenAI.

### Azure OpenAI

Azure OpenAI no usa la misma URL ni el mismo formato que OpenAI publico. Se necesita el recurso de Azure y un deployment.

Secrets esperados:

```bash
AZURE_OPENAI_ENDPOINT=https://TU-RECURSO.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=nombre-del-deployment
AZURE_OPENAI_API_VERSION=2024-10-21
```

Importante: `AZURE_OPENAI_DEPLOYMENT` es el nombre del deployment en Azure, no necesariamente el nombre del modelo. Por ejemplo, el deployment puede llamarse `lab-extractor` aunque por debajo use `gpt-4o-mini`.

Contrato de salida que debe respetar Azure OpenAI:

```json
[
  {
    "n": "Glucosa",
    "val": 112,
    "unit": "mg/dL",
    "range_": "70-99",
    "st": "hi",
    "dir": "flat"
  }
]
```

### Implementacion recomendada por fases

Fase 1: validar lectura de PDF con Azure Document Intelligence.

```text
PDF -> Azure Document Intelligence -> texto extraido -> response/debug
```

Objetivo: confirmar que Azure puede leer los PDFs reales de laboratorio.

Fase 2: conectar Azure OpenAI.

```text
texto extraido -> Azure OpenAI -> JSON de analitos
```

Objetivo: validar que el modelo devuelve JSON estable y parseable.

Fase 3: persistir en Supabase.

```text
JSON analitos -> labs -> realtime -> portal doctor
```

Objetivo: cerrar el flujo clinico en UI.

Fase 4: fallback.

```text
Azure Document Intelligence + parser
  -> si confianza baja: Azure OpenAI o Claude
```

Objetivo: reducir costo y aumentar control.

### Modo hibrido recomendado

La Edge Function `extract-labs` ya sigue este orden:

```text
1. Si AZURE_DOCUMENT_INTELLIGENCE_* existe:
     extraer texto con Azure Document Intelligence.
2. Si AZURE_OPENAI_* existe:
     convertir texto a JSON con Azure OpenAI.
3. Si no hay Azure OpenAI pero existe ANTHROPIC_API_KEY:
     usar Claude sobre el texto extraido por Azure Document Intelligence.
4. Si no hay IA configurada:
     devolver error claro o usar modo mock/dev.
```

Esto permite probar Azure sin romper el flujo Claude actual.

## Estrategia recomendada para produccion grande

Para escalar a un entorno hospitalario, la extraccion debe evolucionar de una llamada directa a IA hacia una tuberia robusta, auditable y de menor costo.

### Arquitectura recomendada

```text
PDF subido
  -> registro lab_documents/document_processing_jobs
  -> cola de procesamiento
  -> extraccion primaria
  -> normalizacion medica
  -> scoring de confianza
  -> revision humana si aplica
  -> publicacion en labs
  -> auditoria completa
```

### 1. Ingesta

Cuando se sube un PDF, crear un registro con estado:

- `uploaded`
- `processing`
- `parsed`
- `needs_review`
- `approved`
- `failed`

Esto permite saber si el documento esta pendiente, procesado, con error o esperando validacion.

### 2. Extraccion primaria sin LLM

Antes de usar IA:

- Si el PDF tiene texto digital, extraer texto con librerias como PDF.js/pdfjs-dist.
- Si el PDF esta escaneado, aplicar OCR con Tesseract u OCRmyPDF.
- Detectar proveedor/laboratorio cuando sea posible.
- Aplicar reglas, regex y plantillas por proveedor.

Muchos PDFs de laboratorio son suficientemente estructurados para extraer Glucosa, Hemoglobina, Creatinina, unidades y rangos sin IA.

### 3. Normalizacion medica

No basta con extraer texto. Hay que normalizar:

- `GLU`, `Glucosa`, `Glucosa serica`, `Glucose` -> mismo analito interno.
- Unidades equivalentes.
- Rangos de referencia.
- Fecha de toma.
- Laboratorio origen.
- Documento fuente.

Idealmente se debe mapear a estandares como LOINC cuando se pase a produccion clinica.

### 4. IA como fallback

Claude, u otro modelo, debe usarse cuando:

- El parser no entiende el documento.
- El OCR sale con baja calidad.
- El formato del laboratorio es nuevo.
- Hay tablas complejas.
- El score de confianza es bajo.

Esto reduce costo y aumenta control. La IA queda como fallback inteligente, no como unica fuente de verdad.

### 5. Revision humana

Para produccion hospitalaria, los datos extraidos automaticamente deberian ir a revision cuando:

- Hay baja confianza.
- Hay valores criticos.
- El formato es desconocido.
- El modelo o parser no puede explicar el origen exacto del dato.

Una bandeja de validacion permitiria comparar:

- PDF original.
- Texto extraido.
- Analitos detectados.
- Valor sugerido.
- Campo editable.
- Boton aprobar/rechazar.

### 6. Auditoria

Guardar siempre:

- PDF original.
- Texto OCR o texto extraido.
- Metodo usado: `parser`, `ocr`, `llm`.
- Version del extractor.
- Prompt/modelo si se uso IA.
- Analitos detectados.
- Confianza.
- Usuario que aprobo o corrigio.
- Fecha y hora de cada paso.

Esto es indispensable para trazabilidad clinica.

### 7. Integracion hospitalaria real

A escala, lo ideal no es depender de PDFs si existe una fuente estructurada.

El camino mas solido es integrar con:

- LIS/HIS/RIS.
- HL7/FHIR.
- APIs internas de laboratorio.
- SSO corporativo.
- Infraestructura Muguerza.

En ese escenario, el PDF queda como respaldo visual y no como fuente primaria de datos.

## Camino de evolucion

### Demo actual

- Supabase Auth.
- Supabase Postgres.
- Supabase Storage.
- Portal doctor.
- Portal secretaria.
- Edge Function con Claude.
- Extraccion directa PDF/imagen -> `labs`.

### MVP robusto

- Tabla de jobs de procesamiento.
- Estados de extraccion.
- Reintentos.
- Errores visibles.
- Vista de revision.
- Parser sin IA para PDFs digitales.
- OCR para PDFs escaneados.
- Claude solo como fallback.

### Produccion hospitalaria

- Backend dedicado: NestJS, FastAPI u otro stack hospitalario.
- Cola: BullMQ, Temporal, Cloud Tasks o equivalente.
- Worker de documentos.
- OCR controlado.
- Normalizacion clinica.
- Integracion HL7/FHIR.
- Auditoria completa.
- SSO Azure AD.
- Politicas RLS estrictas.
- Cumplimiento regulatorio aplicable.

## Notas de desarrollo

- La capa `src/api/*` actua como frontera entre componentes y Supabase.
- La intencion es que los componentes no conozcan detalles de SQL ni Storage.
- `src/api/index.ts` exporta toda la capa de datos desde un solo punto.
- `supabase/lab_extraction_patch.sql` es el archivo recomendado para actualizar la base actual sin destruir datos.
- `supabase/schema.sql` sirve como schema demo completo, pero debe revisarse antes de usarlo en una base con datos existentes.

## Verificacion

Validacion TypeScript:

```bash
npx.cmd tsc -b
```

Build completo:

```bash
npm.cmd run build
```

En algunos entornos Windows con sandbox puede fallar Vite/esbuild con `spawn EPERM`; si TypeScript pasa y el error ocurre al iniciar esbuild, normalmente es un problema de permisos del entorno, no del codigo fuente.

