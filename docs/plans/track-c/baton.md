# Baton — Track C: Voces & transversales

**Worktree:** `.claude/worktrees/voces+track-c` · **Branch:** `worktree-voces+track-c`
**Master plan:** `docs/plans/track-c/master-plan-track-c.md`

## Status
Plan aprobado. Sub-plans escritos para las 8 issues (#17, #36, #34, #18, #19, #20, #21, #35).
#36 (infra de compartir) implementado y verificado — ver evidencia abajo.

## Progress
- [x] Master plan de Track C escrito y verificado contra bloqueos reales de GitHub (no solo
      `master-plan.md` de la raíz)
- [x] Sub-plan #17 — Lista de personajes (listo, ejecutable)
- [x] Sub-plan #36 — Componente de compartir (**implementado**: `src/lib/share.ts` +
      `src/lib/share.test.ts`, `npm run test` 23/23 verde, `npm run typecheck` limpio. No cierra
      el issue de GitHub #36 — falta que #11/#16/#21/#26 lo consuman.)
- [x] Sub-plan #34 — Ajustes esqueleto (listo, ejecutable parcial)
- [x] Sub-plan #18 — Chat 1ra persona (listo, bloqueado por #7 de Track B)
- [x] Sub-plan #19 — Guardrail duro (listo, bloqueado por #18)
- [x] Sub-plan #20 — Cuota Voces (listo, bloqueado por #18)
- [x] Sub-plan #21 — Compartir cita (listo, bloqueado por #18 y #36)
- [x] Sub-plan #35 — Borrar historial (listo, bloqueado por #14/#18/#28)
- [x] Ejecución de O2 — #36 hecho
- [ ] Ejecución de O2 — #17, #34 pendientes

## Next
Seguir con #17 o #34 (no comparten archivo con #36, se pueden hacer en cualquier orden). Antes de
tomar cualquier issue de O3, confirmar en GitHub que #7 (Track B) está mergeado; antes de #35 (O4),
confirmar #14 y #28. Cuando #11/#16/#21/#26 empiecen a consumir `src/lib/share.ts`, avisar para
cerrar el issue #36 en GitHub.
