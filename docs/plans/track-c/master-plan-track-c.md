# Master plan — Track C: Voces & transversales

**Worktree:** `.claude/worktrees/voces+track-c` (branch `worktree-voces+track-c`)
**Fuente:** `master-plan.md` (raíz del repo) §2b, issues de GitHub #17-21, #34-36.
**Dueño de superficie:** `convex/voices.ts`, `convex/rag/prompts/voices.ts`, `app/(tabs)/voces/*`,
`convex/history.ts`, `app/ajustes.tsx`, `src/lib/share.ts`.

## Estado real de bloqueos (verificado contra GitHub, no solo `master-plan.md`)

| Issue | Bloqueado por | Estado del bloqueo | Ejecutable ahora |
|---|---|---|---|
| #17 Lista personajes | #1, #2 | ambos ✅ mergeados | **Sí** |
| #36 Componente compartir | #11, #16, #21, #26 | ninguno hecho (son de otros tracks + #21 de este track) | **Parcial** — se construye el componente/infra ahora (regla dura #3); el issue de GitHub no se cierra hasta que los 4 consumidores lo usen |
| #34 Ajustes (esqueleto) | #9, #10 | #9 ✅, #10 ⬜ (Track A, O2) | **Parcial** — versión bíblica + modo oscuro sí; hora de recordatorio espera a #10 |
| #18 Chat 1ra persona | #7, #17 | #7 ⬜ (Track B, RAG function, no arrancada) | **No** — sin #7 no hay pipeline RAG al que anclar el prompt (regla dura #4) |
| #19 Guardrail duro | #18 | bloqueado transitivamente | **No** |
| #20 Cuota Voces | #18 | bloqueado transitivamente | **No** |
| #21 Compartir cita | #18 | bloqueado transitivamente | **No** |
| #35 Borrar historial | #14, #18, #28 | ninguno hecho (Track B #14, este track #18, Track A #28) | **No** |

**Consecuencia:** de las 8 issues, solo 3 tienen sub-plan ejecutable en esta oleada (#17, #36, #34);
las otras 5 tienen sub-plan **aprobado y listo**, pero `execute-plan` no debe arrancarlas hasta que
sus bloqueos de GitHub se cierren. Antes de tomar cualquiera de #18/#19/#20/#21/#35, releer este
estado — puede haber cambiado.

## Oleadas (orden de ejecución dentro del track, un worktree, un agente)

**O2** (en paralelo entre sí — no comparten archivo):
1. `#17` — `convex/voices.ts` (tabla + query personajes), `app/(tabs)/voces/*`
2. `#36` — `src/lib/share.ts` (nuevo, infra)
3. `#34` — `app/ajustes.tsx`, `convex/schema.ts` (campos ya existen: `bibleVersion`, `reminderHour`)

**O3** (bloqueada por #7 de Track B — no arrancar sin confirmar que #7 está mergeado):
4. `#18` — depende de #17 (este track, O2) y de `convex/rag/*` (Track B)
5. `#19` — depende de #18
6. `#20` — depende de #18, reusa patrón de cuota de `convex/quotas.ts` (Track B, servicio único — regla dura #3, no crear variante local)
7. `#21` — depende de #18 y de `src/lib/share.ts` (#36, este track)

**O4** (bloqueada por #14 de Track B y #28 de Track A):
8. `#35` — depende de #18 (historial de voces) + #14/#28 (historial de Q&A y Sentimiento)

## Reglas duras aplicables a este track

- **Regla dura #1** — cualquier color/tipografía/espaciado nuevo en `app/(tabs)/voces/*`,
  `app/ajustes.tsx` sale de `design/tokens.json` vía `src/theme/tokens.ts`. Ninguna sub-plan de
  este track introduce un literal.
- **Regla dura #2** — `#17` lista **solo** personajes humanos; `#18`/`#19` son el guardrail que lo
  hace cumplir en el chat. Ningún prompt en `convex/rag/prompts/voices.ts` permite 1ra persona para
  Jesús/Dios/Espíritu Santo bajo ninguna instrucción del usuario (issue #19, tests del issue #19 en
  verde antes de mergear cualquier cambio a ese prompt).
- **Regla dura #3** — `src/lib/share.ts` (#36) es el único componente de compartir del proyecto;
  `#21` lo consume, no reimplementa. `#20` reusa `convex/quotas.ts` (Track B), no crea cuota local.
- **Regla dura #4** — `#18` sale del pipeline RAG de Track B (`convex/rag/answer` o equivalente),
  con cita verificable a RVR1960 + comentario evangélico. No hay generación libre de personaje.

## Sub-plans

Uno por issue en `docs/plans/track-c/sub-plan-<issue>-<slug>.md`. Cada uno sigue el formato:
goal, files in scope, out of scope, approach, depends-on, test plan, evidence.

## Baton

`docs/plans/track-c/baton.md` — se actualiza en cada sesión de `execute-plan` (status/progress/next).
