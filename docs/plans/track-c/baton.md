# Baton — Track C: Voces & transversales

**Worktree:** `.claude/worktrees/voces+track-c` · **Branch:** `worktree-voces+track-c`
**Master plan:** `docs/plans/track-c/master-plan-track-c.md`

## Status
Plan aprobado. Sub-plans escritos para las 8 issues (#17, #36, #34, #18, #19, #20, #21, #35).
#36 (infra de compartir) y #17 (lista de personajes) implementados y verificados — ver evidencia
abajo. #36 ya mergeado a master (PR #48).

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
- [x] Sub-plan #34 — Ajustes esqueleto (listo, ejecutable parcial)
- [x] Sub-plan #18 — Chat 1ra persona (listo, bloqueado por #7 de Track B)
- [x] Sub-plan #19 — Guardrail duro (listo, bloqueado por #18)
- [x] Sub-plan #20 — Cuota Voces (listo, bloqueado por #18)
- [x] Sub-plan #21 — Compartir cita (listo, bloqueado por #18 y #36)
- [x] Sub-plan #35 — Borrar historial (listo, bloqueado por #14/#18/#28)
- [x] Ejecución de O2 — #36 hecho (mergeado, PR #48)
- [x] Ejecución de O2 — #17 hecho (pendiente de PR/merge)
- [ ] Ejecución de O2 — #34 pendiente

## Next
Seguir con #34 (ajustes esqueleto) para cerrar O2. Antes de tomar cualquier issue de O3, confirmar
en GitHub que #7 (Track B) está mergeado; antes de #35 (O4), confirmar #14 y #28. Cuando
#11/#16/#21/#26 empiecen a consumir `src/lib/share.ts`, avisar para cerrar el issue #36 en GitHub.
