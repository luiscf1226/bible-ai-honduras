# Fuente de los planes de lectura

## Plan anual

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

## Recorridos (#115)

Un JSON por recorrido, con el mismo formato que `canonico.json` y entre 7 y 30 días. Un
recorrido **es un plan con menos días**: reusa el motor (`convex/readingPlans.ts`) y las
tablas (`readingPlans`, `userPlanProgress`) del plan anual, sin tablas nuevas. El progreso
es una fila por (usuario, plan), así que un recorrido se sigue a la par del plan anual sin
pisarlo.

Cada lectura puede acotarse a un pasaje con `verseStart`/`verseEnd` (los dos juntos); sin
ellos es el capítulo completo. El lector abre en `verseStart`.

**Regla dura #4.** Armar un itinerario temático es juicio editorial, así que los JSON solo
llevan un nombre, una descripción de una línea y referencias bíblicas: ningún título
devocional, reflexión ni comentario. `convex/readingPlanCatalog.test.ts` valida que cada
referencia existe en el canon (libro, capítulo dentro de rango, `verseStart <= verseEnd` y
`verseEnd` dentro del capítulo) y que ningún recorrido trae campos de texto extra.

Para agregar un recorrido: crear el JSON acá, importarlo en `JOURNEY_READING_PLANS`
(`convex/readingPlanCatalog.ts`) y, si cita pasajes, anotar la cantidad de versículos del
capítulo en `VERSES_IN_CHAPTER` del test. El cron `ensurePlanSeeded` lo siembra solo.

El puente desde Sentir (sentimiento → recorrido) vive en
`src/features/reading/feelingJourneys.ts`: Ansiedad y Miedo → Ansiedad, Duelo → Duelo,
Necesito perdonar → Perdón, Cansancio → Salmos para dormir. Los demás sentimientos no
muestran recorrido.

### Recorridos pendientes de revisión pastoral antes del lanzamiento

Los pasajes los eligió el equipo técnico con criterio de "conocido y directamente
pertinente". **Tienen que pasar por revisión pastoral antes del lanzamiento.**

**Ansiedad** (`ansiedad.json`, 7 días)
1. Mateo 6:25-34
2. Filipenses 4:4-9
3. Salmos 23
4. 1 Pedro 5:6-11
5. Isaías 41:8-13
6. Salmos 46
7. Juan 14:1-27

**Perdón** (`perdon.json`, 7 días)
1. Salmos 32
2. Salmos 51
3. 1 Juan 1:5-10
4. Lucas 15:11-32
5. Mateo 18:21-35
6. Efesios 4:25-32
7. Colosenses 3:12-17

**Duelo** (`duelo.json`, 7 días)
1. Salmos 34
2. Juan 11:17-44
3. Lamentaciones 3:19-33
4. 2 Corintios 1:3-7
5. 1 Tesalonicenses 4:13-18
6. 1 Corintios 15:50-58
7. Apocalipsis 21:1-7

**Salmos para dormir** (`salmos-para-dormir.json`, 7 días)
1. Salmos 4
2. Salmos 3
3. Salmos 63
4. Salmos 91
5. Salmos 121
6. Salmos 127
7. Salmos 131

**La vida de José** (`vida-de-jose.json`, 13 días)
Génesis 37, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49 y 50, un capítulo por día.
Génesis 38 (Judá y Tamar) queda fuera a propósito: interrumpe la historia de José.

**Semana Santa** (`semana-santa.json`, 8 días)
1. Mateo 21:1-17
2. Mateo 26:1-16
3. Juan 13:1-17
4. Mateo 26:17-30
5. Mateo 26:36-56
6. Mateo 27:1-31
7. Mateo 27:32-66
8. Mateo 28
