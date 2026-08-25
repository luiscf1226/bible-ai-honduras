# Baton — Track C: Voces & transversales

**Worktree:** `.claude/worktrees/track-c-34` · **Branch:** `track-c/34-cerrar-ajustes`
**Master plan:** `docs/plans/track-c/master-plan-track-c.md`

## Status
Cola de esta semana (Dev C): **#34 → #35 → #30**. Voces (#18–#21) sigue bloqueada por #7.
Issue #34 en GitHub está cerrado como esqueleto (PR #52); este baton cierra los criterios reales:
versión citada según `bibleVersion`, noche suave aplicada, hora de recordatorio persistida para #10.

**Nota de Dev B (Track B), 2026-08-24:** #7 se construye solo sobre #5 (versículos, ya mergeado en
`convex/rag/verses.ts`) — el "Bloqueado por: #5, #6" del issue de GitHub está desactualizado, #6
(comentarios evangélicos) ya no es precondición de #7, entra después a enriquecer la respuesta.
Dev B avisa en el canal apenas #7 mergee — esa es la señal de arranque real de O3, no hace falta
poll manual del estado de GitHub. Archivos de #7: `convex/rag/retrieve.ts`, `convex/rag/answer.ts`,
`convex/rag/prompts/`, `convex/rag/commentary.ts` — ninguno pisa superficie de Track C.

## Progress
- [x] Master plan de Track C escrito y verificado contra bloqueos reales de GitHub (no solo
      `master-plan.md` de la raíz)
- [x] Sub-plan #17 — Lista de personajes (mergeado, PR #49)
- [x] Sub-plan #36 — Componente de compartir (mergeado, PR #48; issue abierto hasta consumidores)
- [x] Sub-plan #34 — Ajustes esqueleto (mergeado, PR #52)
- [x] Cerrar #34 de verdad: `verses.citedForUser` respeta `users.bibleVersion` (NVI sin corpus
      no inventa texto); `nightTokens` medidos del prototipo `isHomeDark` vía ThemeProvider
      (no se tocó `tokens.ts` / `tokens.json`); hora 6/12/21 se guarda en `reminderHour` desde
      Ajustes y onboarding (para que #10 la consuma); Home cita la versión y abre `/ajustes`.
      `npm test` 75/75.
- [x] Sub-plan #18 — Chat 1ra persona (listo, bloqueado por #7 de Track B)
- [x] Sub-plan #19 — Guardrail duro (listo, bloqueado por #18)
- [x] Sub-plan #20 — Cuota Voces (listo, bloqueado por #18)
- [x] Sub-plan #21 — Compartir cita (listo, bloqueado por #18 y #36)
- [ ] #35 — Borrar historial (hard delete; tablas `conversations`/`messages` aún no existen)
- [ ] #30 — UI de paywall (`app/paywall.tsx`; consume `entitlements.mine` y `revenuecat.ts`)
- [x] Ejecución de O2 — #36 hecho (mergeado, PR #48)
- [x] Ejecución de O2 — #17 hecho (mergeado, PR #49)
- [x] Ejecución de O2 — #34 esqueleto (mergeado, PR #52)

## Next
#35 (borrar historial de verdad) → #30 (UI de paywall). No arrancar Voces hasta que #7 mergee.
Cuando #7 mergee: tests adversariales de #19 **antes** del prompt de #18.
