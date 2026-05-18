# Handoff - Demo mac shell

Fecha: 2026-05-13

## Contexto

Muguerza Connect tenia un marco visual tipo macOS/VM alrededor de toda la app. Ese encuadre sirvio para la demostracion inicial del producto, pero ya no debe aparecer en la experiencia normal.

## Cambios hechos

- `src/App.tsx` ahora renderiza la app a pantalla completa por defecto.
- `src/shell.css` conserva el estilo del marco demo, pero separado del modo normal.
- `.env.local` incluye `VITE_DEMO_MAC_SHELL=false`.
- `src/vite-env.d.ts` reconoce la variable opcional `VITE_DEMO_MAC_SHELL`.
- `README.md` documenta que el marco fue solo para demo inicial y podria eliminarse en el futuro.

## Como reactivarlo temporalmente

Cambiar en `.env.local`:

```text
VITE_DEMO_MAC_SHELL=true
```

Luego reiniciar Vite.

## Validacion

Se ejecuto:

```text
npx.cmd tsc -b
```

Resultado: paso sin errores.
