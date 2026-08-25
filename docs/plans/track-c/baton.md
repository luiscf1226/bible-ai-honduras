# Baton — Track C: Voces & transversales

**Worktree:** `.claude/worktrees/voces+track-c` · **Branch:** `worktree-voces+track-c`
**Master plan:** `docs/plans/track-c/master-plan-track-c.md`

## Status
Plan aprobado. Sub-plans escritos para las 8 issues (#17, #36, #34, #18, #19, #20, #21, #35).
**Oleada O2 completa y mergeada a master:** #36 (PR #48), #17 (PR #49), #34 (PR #52).
Oleada O3 (#18, #19, #20, #21) bloqueada — #7 (función RAG, Track B) sigue abierto en GitHub a la
fecha de este baton (2026-08-24). No arrancar O3 hasta confirmar que #7 está mergeado.

## Progress
- [x] Master plan de Track C escrito y verificado contra bloqueos reales de GitHub (no solo
      `master-plan.md` de la raíz)
- [x] Sub-plan #17 — Lista de personajes (**implementado**: `convex/voicesCatalog.ts` (catálogo
      estático de 6 personajes, mismo patrón que `devotionalCatalog.ts`), `convex/voices.ts`
      (query `list`), `convex/voices.test.ts`, pantalla `app/(tabs)/voces.tsx` con datos y
      gradientes tomados 1:1 del prototipo. Agregado `expo-linear-gradient` como dependencia
      (necesaria para el avatar degradado) y `cardPadding`/`size.avatar` a `src/theme/tokens.ts`
      — medidos del prototipo, mismo criterio que el resto de `size`. `npm run test` 25/25 verde,
      `npm run typecheck` limpio, `expo export --platform web` bundlea sin errores.)
- [x] Sub-plan #36 — Componente de compartir (**implementado**: `src/lib/share.ts` +
      `src/lib/share.test.ts`, `npm run test` 23/23 verde, `npm run typecheck` limpio. No cierra
      el issue de GitHub #36 — falta que #11/#16/#21/#26 lo consuman.)
- [x] Sub-plan #34 — Ajustes esqueleto (**implementado**: `app/ajustes.tsx` con versión bíblica
      + modo noche suave; agrega `users.darkMode` a schema/`updatePreferences` (append-only,
      opcional). Recordatorio (#10) y "Mis conversaciones"/borrar historial (#35) quedan fuera,
      tal como marca el sub-plan. Falta que algún track enlace la pantalla desde algún ícono de
      navegación — ruta `/ajustes` ya es alcanzable vía `router.push`. `npm run test` 26/26 verde,
      `npm run typecheck` limpio, `expo export --platform web` bundlea sin errores.)
- [x] Sub-plan #18 — Chat 1ra persona (listo, bloqueado por #7 de Track B)
- [x] Sub-plan #19 — Guardrail duro (listo, bloqueado por #18)
- [x] Sub-plan #20 — Cuota Voces (listo, bloqueado por #18)
- [x] Sub-plan #21 — Compartir cita (listo, bloqueado por #18 y #36)
- [x] Sub-plan #35 — Borrar historial (listo, bloqueado por #14/#18/#28)
- [x] Ejecución de O2 — #36 hecho (mergeado, PR #48)
- [x] Ejecución de O2 — #17 hecho (mergeado, PR #49)
- [x] Ejecución de O2 — #34 hecho (mergeado, PR #52)

## Next
O2 completa. Antes de tomar cualquiera de O3 (#18, #19, #20, #21), confirmar en GitHub que #7
(Track B, función RAG) está mergeado — sin eso no hay pipeline al que anclar el prompt de Voces
(regla dura #4). Antes de #35 (O4), confirmar #14 y #28 también. Cuando #11/#16/#21/#26 empiecen a
consumir `src/lib/share.ts`, avisar para cerrar el issue #36 en GitHub.
