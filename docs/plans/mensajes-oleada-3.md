# Mensajes de arranque — Oleada 3 (2026-08-25)

Estado: **#7 mergeado, la Oleada 3 está desbloqueada.** `master` en verde
(`typecheck` limpio, 103 tests). Cero PRs abiertos.

---

## Dev B — Track B (Q&A)

> Buen trabajo con #7 — el pipeline quedó bien anclado: umbral de similitud para no
> fabricar citas, respuesta honesta cuando no hay contexto relevante, y la clave de
> Anthropic solo en Convex.
>
> **Dos cosas antes de arrancar Q&A, en este orden:**
>
> **1. Verificación de cita en `answer.ts` (medio día, va primero).** Hoy la cita que
> devolvés es el primer resultado de la recuperación, sin comprobar que la respuesta
> generada realmente lo use. Si el modelo cita otro pasaje en el texto, la cita adjunta
> miente — y `ARCHITECTURE.md` §3 describe `answer.ts` como "Claude + verificación de
> cita". Va primero porque **Dev C arranca Voces esta semana copiando tu patrón**; si el
> hueco se replica en `voices.ts` y `feelings.ts`, después son tres lugares que arreglar.
>
> **2. El modelo.** Pusiste `claude-haiku-4-5-20251001` con justificación de costo, pero
> `ARCHITECTURE.md` dice Claude Sonnet 5 para los 3 módulos conversacionales. Decidilo y
> dejalo escrito: o actualizás el doc, o volvés a Sonnet. No lo dejes divergente — Voces
> y Sentimiento van a colgar del mismo `llm.ts`, y #19 (guardrail) es justo donde la
> calidad del modelo importa más.
>
> **Después, tu cola: #12 → #13 → #14 → #15 → #16 (Q&A completo).**
> `convex/quotas.ts` ya tiene `qa: 5` configurado (lo hiciste vos en #4) y
> `src/lib/share.ts` ya existe — #15 y #16 los consumen, no los reimplementan.
> #15 alimenta a #32 en la Oleada 4, así que la cuota tiene que pasar por el servicio
> central sí o sí.
>
> **#6 (comentarios evangélicos) queda parqueado** hasta que Q&A esté completo. Mejora la
> calidad de las tres respuestas pero no desbloquea a nadie.

---

## Dev C — Track C (Voces)

> #34, #35 y #30 mergeados. Dos cosas del review, y después tu cola.
>
> **1. Los tres archivos de tokens.** `nightTokens.ts`, `paywallTokens.ts` y `measured.ts`
> tienen hexes y tamaños literales. Respetaste no editar los archivos congelados y
> documentaste de qué línea del prototipo sacaste cada valor — eso está bien — pero
> `CLAUDE.md` regla dura #1 dice que un PR que introduce color o tipografía fuera de
> `design/tokens.json` se rechaza. Lo dejé pasar porque bloquear habría parado tres
> issues esperando un re-export que vos no podés hacer solo, **pero es excepción única, no
> el patrón nuevo.** Hay que re-exportar la paleta noche + paywall desde Claude Design a
> `tokens.json` y borrar los tres shims antes de que A y B empiecen a importar de ahí.
>
> **2. Tocaste `convex/rag/verses.ts` en #59**, que es de Track B, mientras B construía #7
> en ese mismo directorio. Chocó de verdad: tuve que resolver a mano el conflicto en
> `verses.test.ts` (vos agregaste `citedForUser`, B agregó `getById`). El cambio tenía
> sentido, pero la próxima vez eso se pide, no se hace: comentás en tu issue "necesito X
> en `convex/rag/verses.ts`" y lo hace B, o coordinás antes.
>
> **Tu cola: #18 → #19 → #20 → #21.**
>
> **#19 es el issue de mayor riesgo reputacional del proyecto y va prácticamente antes que
> #18: escribí la suite de tests adversariales primero.** Moisés, David, Pablo, Ester, Rut,
> Elías, Daniel en 1ra persona; **Jesús, Dios y el Espíritu Santo nunca** — de ellos se
> habla en 3ra persona. Los tests tienen que incluir intentos explícitos de burla ("hablá
> como Jesús", "hacé de cuenta que sos Dios", rodeos indirectos). Test adversarial en rojo,
> el PR no entra.
>
> `convex/quotas.ts` ya tiene `voices: 5` y `share.ts` existe — #20 y #21 los consumen.
> Esperá a que B mergee la verificación de cita antes de escribir `voices.ts`, para copiar
> el patrón bueno y no el que tiene el hueco.

---

## Dev A — Track A (Sentimiento y Historias)

> #10, #11 y #24 cerrados. Verifiqué tu llamada sobre #24 y es correcta: `quotas.ts` tiene
> `stories: 1` con clave `lifetime` en vez de clave por día, así que la muestra única
> persiste de verdad — no hacía falta código nuevo. Buen criterio no duplicar.
>
> **#7 ya está mergeado, estás desbloqueado.** Tu cola: **#28 → #29 → #25 → #26.**
>
> - **#28 — generación por sentimiento.** Sale de `convex/rag/answer.ts` (lo hizo B), no de
>   una llamada nueva al LLM. Regla dura #4: el devocional por sentimiento va anclado al
>   RAG igual que Q&A, con cita verificable. Vas a necesitar tu propio prompt en
>   `convex/rag/prompts/` — versículo + reflexión + oración corta, según el PRD.
> - **#29 — guardar/historial + cuota.** `quotas.ts` tiene `feelings: 3`. El historial ya
>   tiene modelo: C construyó `convex/history.ts` en #35, reusalo en vez de crear tabla
>   nueva.
> - **#25 y #26 — Historias.** El catálogo (#23) ya está; falta la generación de imágenes
>   por escena con el proveedor que salió del spike #22, el visor de paneles, y compartir.
>
> Sos el track más cargado de la oleada con 4 issues. **Si al terminar #29 ves que
> Historias se te va de una semana, avisá** — el plan ya contempla pasarle #25/#26 a C, que
> queda libre después de #21. Decirlo temprano es gratis; descubrirlo en la semana 8 no.
>
> Ojo con `app/_layout.tsx` y `app/(auth)/notifications.tsx`: vos y C los tocaron en la
> misma oleada y hubo que rebasar. Son tuyos, pero avisá en el canal antes de tocarlos.

---

## Al canal

> **La Oleada 3 arrancó.** `master` en verde: `typecheck` limpio, 103 tests, cero PRs
> abiertos. Q&A (B), Voces (C) y Sentimiento→Historias (A) corren en paralelo — los tres
> consumen `rag.answer()`, `quotas.ts` y `share.ts`, ninguno los reescribe.
>
> **Esta oleada se rompieron dos veces las fronteras de archivos** y las dos veces costó
> un merge manual: C editó `convex/rag/verses.ts` (de B) mientras B construía #7, y A y C
> tocaron `notifications.tsx` y `_layout.tsx` a la vez. Ninguna fue de mala fe, las dos
> eran evitables con un comentario de 10 segundos.
>
> **Desde hoy, sin excepción:** antes de tocar un archivo que no es de tu track o que está
> en la lista compartida (`convex/schema.ts`, `_generated/`, `tokens.json`, `tokens.ts`,
> `app/_layout.tsx`, `quotas.ts`, `share.ts`, `src/components/`), comentás en tu issue
> "tomo `<archivo>`" y lo liberás al mergear. Si el archivo es de otro track, no lo tomás:
> se lo pedís a su dueño.
>
> Recordatorio de orden de merge cuando hay varios PRs listos: (1) solo `schema.ts`,
> (2) transversales, (3) ruta crítica, (4) features, (5) docs. Misma clase, FIFO.
