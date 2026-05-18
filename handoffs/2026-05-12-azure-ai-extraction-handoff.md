# Handoff - Azure AI lab extraction

Fecha: 2026-05-12

## Contexto

Muguerza Connect ya tiene implementada una ruta hibrida para extraer resultados de laboratorio desde PDFs o imagenes subidas por secretaria como `Resultado de lab`.

El objetivo es que el flujo quede asi:

```text
PDF/imagen en Supabase Storage
  -> signed URL temporal
  -> Supabase Edge Function extract-labs
  -> Azure Document Intelligence lee OCR/Layout
  -> Azure OpenAI o Claude convierte texto a JSON de analitos
  -> tabla labs
  -> realtime en portal del doctor
```

## Cambios ya hechos en codigo

Archivo modificado:

```text
supabase/functions/extract-labs/index.ts
```

La Edge Function ahora:

1. Descarga el documento desde el signed URL.
2. Si existen `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` y `AZURE_DOCUMENT_INTELLIGENCE_KEY`, usa Azure Document Intelligence.
3. Si tambien existen `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` y `AZURE_OPENAI_DEPLOYMENT`, usa Azure OpenAI para convertir el texto a JSON.
4. Si no hay Azure OpenAI pero existe `ANTHROPIC_API_KEY`, usa Claude sobre el texto extraido por Azure Document Intelligence.
5. Si falla Azure Document Intelligence y existe Claude, cae a Claude directo con el documento.
6. Inserta o actualiza filas en `labs`.
7. Devuelve `extractor` para saber que ruta se uso.

Tambien se actualizo:

```text
README.md
```

para documentar que `extract-labs` ya es hibrida y no solo Claude.

## Validacion local

Comando ejecutado:

```bash
npx.cmd tsc -b
```

Resultado: paso correctamente.

No se valido con Deno local porque `deno` no esta disponible en esta maquina.

## Azure Document Intelligence

Recurso creado:

```text
Nombre: docintela012864480512
Grupo de recursos: TEC
Suscripcion: Azure for Students
Region: West US 2
Plan: Free F0
Endpoint: https://docintela012864480512.cognitiveservices.azure.com/
```

Secrets que deben existir en Supabase Edge Functions:

```bash
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://docintela012864480512.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read
```

La key puede ser cualquiera de las dos keys del recurso en Azure Portal.

## Azure OpenAI

Recurso creado:

```text
Nombre: PDFReaderCEI
Tipo: Azure OpenAI
Region: West US
Plan: Estandar S0
```

Se intento crear un deployment para:

```text
Modelo: gpt-4o-mini
Tipo: Estandar
Capacidad: 100K TPM
Region disponible: East US 2
Deployment deseado: lab-extractor
```

Pero fallo porque Azure intento crear un nuevo recurso en East US 2 y el tenant/suscripcion bloqueo la creacion por policy:

```text
InvalidTemplateDeployment: The template deployment failed because of policy violation.
```

Conclusion:

```text
La cuota disponible esta en East US 2, pero el recurso actual PDFReaderCEI esta en West US.
La politica del tenant parece bloquear crear el nuevo recurso automatico en East US 2.
```

## Estado actual funcional

La ruta que debe usarse por ahora es:

```text
Azure Document Intelligence + Claude
```

Esto ya esta soportado por la funcion implementada. No requiere Azure OpenAI.

Secrets minimos para esa ruta:

```bash
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://docintela012864480512.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=...
AZURE_DOCUMENT_INTELLIGENCE_API_VERSION=2024-11-30
AZURE_DOCUMENT_INTELLIGENCE_MODEL=prebuilt-read
ANTHROPIC_API_KEY=...
```

## Pendientes inmediatos

1. Configurar secrets en Supabase Edge Functions.
2. Desplegar la funcion:

```bash
supabase functions deploy extract-labs
```

3. Probar subiendo un documento tipo `Resultado de lab` desde el portal de secretaria.
4. Confirmar que la respuesta de `extract-labs` devuelve:

```json
{
  "inserted": 1,
  "analitos": ["Glucosa"],
  "extractor": "azure_document_intelligence+claude"
}
```

5. Confirmar que el doctor ve los analitos en la pestana `Estudios`.

## Si se quiere insistir con Azure OpenAI

Opciones:

1. Buscar un modelo con cuota disponible en `West US`, para usar el recurso existente `PDFReaderCEI`.
2. Pedir o habilitar cuota en `West US`.
3. Crear manualmente un recurso Azure OpenAI en `East US 2` si la politica del tenant lo permite.
4. Si se logra crear deployment, usar:

```bash
AZURE_OPENAI_ENDPOINT=https://TU-RECURSO.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=lab-extractor
AZURE_OPENAI_API_VERSION=2024-10-21
```

Mientras eso no este resuelto, no configurar `AZURE_OPENAI_*`; la funcion caera automaticamente a Claude despues de Azure Document Intelligence.
