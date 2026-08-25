# Sub-plan #34 — Pantalla de ajustes (esqueleto)

**Oleada:** O2 (esqueleto; cierra en O4) · **Ejecutable ahora:** parcial (bloqueado por #10 para
la hora de recordatorio)

## Goal
Pantalla `app/ajustes.tsx` con: selector de versión bíblica (afecta contenido citado en toda la
app), toggle de modo oscuro (paleta suave del PRD, no negro puro). El campo de hora de recordatorio
queda en el esqueleto pero deshabilitado/oculto hasta que #10 (push diaria, Track A) exista — no
se simula ni se guarda un valor que nada consume todavía.

## Files in scope
- `app/ajustes.tsx` (nuevo)
- `convex/users.ts` — mutation para actualizar `bibleVersion` (campo ya existe en schema); **no**
  tocar `reminderHour` hasta que #10 defina qué lo consume
- `src/theme/` — solo lectura, para aplicar el toggle de modo oscuro vía los tokens ya definidos
  (regla dura #1 — el modo oscuro "suave" ya debe existir como token, no se inventa un color)

## Out of scope
- Hora de recordatorio funcional (espera a #10)
- Borrar historial (#35, distinta oleada, distinta issue aunque viva en la misma pantalla)

## Approach
1. Verificar en `design/tokens.json` que existe la paleta de modo oscuro suave; si no existe,
   **parar y preguntar** (regla dura #1 — no inventar el tono en el componente).
2. `app/ajustes.tsx`: selector RVR1960/NVI que llama a la mutation de `convex/users.ts`; el cambio
   debe reflejarse en todo el contenido citado de la app (verificar que el resto de módulos lean
   `bibleVersion` del usuario, no un valor hardcodeado — si algún módulo lo tiene hardcodeado, es
   nota para ese track, no se arregla aquí fuera de scope).
3. Toggle de modo oscuro: usa el sistema de tema existente (`src/theme/tokens.ts`); confirmar que
   ya soporta esquema oscuro antes de construir uno nuevo.
4. Placeholder visual para "hora de recordatorio" (texto "próximamente" o sección oculta) — no
   input funcional.

## Depends-on
- #9 (fuente de devocional) — ✅ ya mergeado, `bibleVersion` en schema ya existe.
- #10 (push diaria) — ⬜ pendiente (Track A). Sin esto, el campo de hora de recordatorio no tiene
  a quién avisarle — se deja fuera del esqueleto.

## Test plan
- `convex/users.test.ts`: mutation de `bibleVersion` persiste y se refleja en un query de lectura.
- Verificación manual: cambiar versión bíblica en Ajustes y confirmar que una pantalla que cita
  texto (ej. devocional del día) muestra la versión nueva.
- Verificación visual: modo oscuro usa los tokens de `design/tokens.json`, no negro puro (`#000000`
  no debe aparecer literal en el diff).

## Evidence
- `npm run test -- users` en verde.
- Screenshot en modo claro y oscuro contra el prototipo.
- Nota en el PR: "esqueleto — hora de recordatorio pendiente de #10, no cierra #34."
