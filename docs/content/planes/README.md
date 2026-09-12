# Fuente del plan de lectura anual

`canonico.json` es el plan canónico (Génesis → Apocalipsis) del issue #114: 1189 capítulos
repartidos en 365 días lo más parejo posible (271 días de 3 capítulos, 94 días de 4).
Cronológico, M'Cheyne y "NT + Salmos" quedaron fuera de esta primera versión.

No es contenido generado por IA (regla dura #4): se generó con
`scripts/generate-reading-plan.mjs`, una aritmética determinística sobre la cantidad de
capítulos por libro (dato factual de dominio público, no texto con licencia). El
resultado se versiona acá; el script no se corre en cada build.

`convex/readingPlanCatalog.ts` carga y valida este JSON (forma, no contra el canon
completo). El cruce contra `src/lib/bibleBooks.ts` — que cubre cada capítulo del canon
exactamente una vez, en orden, de Génesis 1 a Apocalipsis 22 — es un test
(`convex/readingPlanCatalog.test.ts`), no código de producción: el backend de Convex no
importa nada de `src/` a propósito.

## Operación

- `readingPlans.catalog` expone los metadatos del plan (nombre, descripción, duración)
  directo desde este módulo, sin sesión.
- `readingPlans.ensurePlanSeeded` siembra una copia servible en la tabla `readingPlans`
  la primera vez (cron diario, idempotente) — mismo patrón que `dailyDevotionals`.
- `readingPlans.myProgress` calcula el día de hoy en `America/Tegucigalpa` (reusa
  `hondurasDateKey` de `convex/devotional.ts`) contra `startedAt`, y arma la lista de
  días pendientes para "ponerme al día" sin un contador de atraso.
