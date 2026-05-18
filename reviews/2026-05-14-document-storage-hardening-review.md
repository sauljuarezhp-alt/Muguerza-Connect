# Review: Document Storage Hardening

Fecha: 2026-05-14
Area: documentos clinicos, Supabase Storage, `patient_documents`, signed URLs
Estado: Hardening aplicado y validado.

## Decision de arquitectura

La arquitectura correcta queda asi:

- Postgres guarda metadata, permisos, historial y ligas clinicas.
- Supabase Storage guarda el archivo real.
- El frontend no debe depender de URLs publicas persistidas.
- La lectura se hace con signed URLs de corta vida.

## Estado aplicado

- Buckets privados:
  - `estudios`
  - `polizas`
- Tabla metadata:
  - `public.patient_documents`
- Ruta canonica del objeto:
  - `<patient_id>/<timestamp>_<file_name>`

## Migraciones aplicadas

- `harden_document_storage_patient_scoped_access`
- `enforce_patient_document_storage_metadata_integrity`

## Cambios de seguridad

- Se eliminaron policies amplias de `storage.objects`:
  - `authenticated puede leer`
  - `authenticated puede subir`
  - `mc_documents_select`
  - `mc_documents_insert`
  - `mc_documents_update`
  - `mc_documents_delete`
- Se crearon policies por paciente:
  - `mc_documents_select_patient_scoped`
  - `mc_documents_insert_patient_scoped`
  - `mc_documents_update_patient_scoped`
  - `mc_documents_delete_patient_scoped`

Todas validan:

```sql
bucket_id in ('estudios', 'polizas')
and split_part(name, '/', 1) <> ''
and private.can_access_patient(split_part(name, '/', 1))
```

## Integridad de metadata

`patient_documents` ahora exige:

- `patient_id not null`
- `bucket not null`
- `storage_path not null`
- `url nullable`

Nueva constraint:

```sql
patient_documents_storage_path_matches_patient
check (storage_path like patient_id || '/%')
```

Esto evita que una fila de metadata apunte a un archivo de otro paciente.

## Cambios en frontend/API local

Archivo modificado:

- `src/api/secretary.ts`

Cambios:

- `uploadPatientDocument` ya no llama `getPublicUrl`.
- La fila de `patient_documents` guarda `bucket` y `storage_path`.
- Si el insert de metadata falla despues de subir a Storage, se intenta limpiar el archivo subido.
- `listDocuments` sigue generando signed URLs con `createSignedUrl`.
- `deleteDocument` ahora elimina primero el objeto de Storage y luego la fila metadata.

## Validacion

- `npx.cmd tsc -b` pasa sin errores.
- Advisor Security no reporta nuevos criticals; solo queda `auth_leaked_password_protection`.
- Policies amplias anteriores ya no existen.
- Policies nuevas quedan limitadas por `private.can_access_patient`.
- Los documentos existentes tienen `bucket` y `storage_path`.
- Los documentos existentes cumplen `storage_path like patient_id || '/%'`.

## Pendientes para version final

- Revisar el objeto huerfano detectado en bucket `estudios` antes de borrarlo; no se elimino a ciegas.
- Agregar auditoria explicita de descarga/visualizacion de documentos si se requiere trazabilidad tipo expediente hospitalario.
- Considerar mover upload/delete a RPC o Edge Function si se necesita transaccion fuerte entre metadata e Storage.
- Definir `file_size_limit` y `allowed_mime_types` por bucket antes de produccion.
