# Post-Claude implementation reviews

Esta carpeta guarda revisiones tecnicas posteriores a implementaciones hechas por Claude.

Objetivo: convertir cada feature MVP en conocimiento util para llegar a una version final robusta, sin perder decisiones, riesgos, deuda tecnica ni mejoras futuras.

## Cuándo crear un review

Crear un archivo aqui cuando Saul diga:

- "Claude ya termino X implementacion"
- "Revisa lo que hizo Claude"
- "Ya quedo X feature"
- "Checa si esto esta listo para produccion"

## Formato recomendado

Nombre:

```text
YYYY-MM-DD-fXX-nombre-feature-post-claude-review.md
```

Contenido minimo:

1. **Estado revisado**
   - Fecha.
   - Feature.
   - Archivos creados/modificados.
   - Si hubo cambios de Supabase o solo frontend.

2. **Como funciona actualmente**
   - Flujo por rol de usuario.
   - Datos leidos/escritos.
   - RPCs, tablas, Storage o componentes involucrados.
   - Estados de error/vacio/expiracion/duplicados.

3. **Validacion hecha**
   - TypeScript/build.
   - Pruebas manuales.
   - Pruebas Supabase/RLS si aplica.
   - Limitaciones de la validacion.

4. **Riesgos MVP**
   - Lo que funciona pero puede confundir.
   - Lo que esta aceptable solo por ahora.
   - Supuestos fragiles.

5. **Cambios para version final**
   - Mejoras de UX.
   - Mejoras de arquitectura.
   - Hardening de seguridad.
   - Observabilidad/auditoria.
   - Performance/indices.

6. **Decision**
   - Listo para seguir.
   - Listo con pendientes.
   - Bloqueado.

## Regla de ownership

Claude puede implementar UI/features.

Codex revisa:

- Logica robusta.
- Seguridad.
- Supabase/RLS.
- Contratos de datos.
- Documentacion tecnica.
- Riesgos de evolucion de MVP a producto final.

