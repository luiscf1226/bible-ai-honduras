# Sub-plan #35 — Borrar historial (privacidad)

**Oleada:** O4 · **Ejecutable ahora:** NO — bloqueado por #14 (Track B), #18 (este track), #28
(Track A). Ninguno mergeado todavía.

## Goal
El botón de borrar en Ajustes elimina de verdad las conversaciones guardadas del backend (Voces,
Q&A, Sentimiento), no solo de la vista local.

## Files in scope
- `convex/history.ts` (nuevo) — mutation de borrado que cubre las tablas de historial de los 3
  módulos (Voces, Q&A, Sentimiento) — requiere coordinarse con Track A (#28) y Track B (#14) sobre
  el nombre real de sus tablas de historial antes de escribir la mutation.
- `app/ajustes.tsx` — botón de borrar, wiring a `convex/history.ts`

## Out of scope
- Borrado de datos de otros módulos que no sean historial de conversación (ej. cuotas, preferencias).

## Approach
1. Una vez #14, #18, #28 estén mergeados: confirmar el nombre exacto de cada tabla de historial en
   `convex/schema.ts` (no asumir nombres — leer el schema real al momento de ejecutar este issue).
2. `convex/history.ts`: mutation `deleteAll` (o por módulo) que borra las filas del usuario actual
   en cada tabla de historial — server-side, con verificación de que el borrado es real (test que
   confirma 0 filas post-borrado, no solo que el cliente deja de mostrarlas).
3. UI: confirmación antes de borrar (acción destructiva irreversible) — patrón de diálogo de
   confirmación existente en la app, no uno nuevo.

## Depends-on
- #14 (Track B, historial de Q&A)
- #18 (este track, historial de Voces)
- #28 (Track A, historial de Sentimiento)

## Test plan
- Test de integración: crear historial en los 3 módulos, invocar `deleteAll`, verificar que las
  queries de lectura de cada módulo devuelven vacío — a nivel de backend, no de UI.

## Evidence
- Test en verde mostrando 0 filas post-borrado en las 3 tablas.
