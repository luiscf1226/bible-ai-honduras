# Mensajes de arranque — Oleada 2b (2026-08-25)

Copiá y pegá uno a cada dev. Contexto común al final.

---

## Dev B — Track B (motor RAG)

> **Tu cola esta semana: #7, y después #6. Nada más.**
>
> #7 es el cuello de botella de 13 issues — Q&A completo, Voces completo y Sentimiento
> están parados esperándolo. Mientras #7 no esté en `master`, dos devs tienen media
> capacidad. Por eso no tomás nada más: ni empezar Q&A, ni adelantar paywall.
>
> **Cambio importante:** el issue #7 dice "Bloqueado por: #5, #6". Ignorá el #6.
> Construí #7 solo sobre los versículos de #5 (ya mergeado, `convex/rag/verses.ts`).
> Los comentarios evangélicos de #6 son una *segunda* fuente de recuperación que
> enriquece la respuesta, no una precondición: con versículos ya podés citar de forma
> verificable, que es lo que pide la regla dura #4 de `CLAUDE.md`. #6 entra después y
> mejora la calidad sin bloquear a nadie.
>
> **Archivos tuyos:** `convex/rag/retrieve.ts`, `convex/rag/answer.ts`,
> `convex/rag/prompts/`, `convex/rag/commentary.ts` (para #6).
> **No toques:** `src/theme/tokens.ts`, `design/tokens.json`, `app/_layout.tsx`,
> `src/lib/share.ts`, `convex/quotas.ts` (ya están hechos y tienen otro dueño).
>
> **`convex/schema.ts`:** si necesitás agregar tablas, va en un PR aparte de 10 líneas,
> append-only, mergeado *antes* del PR de la feature. Avisá en el issue antes de tocarlo.
>
> **Definition of done de #7:** dada una pregunta con pasaje, responde citando el
> versículo correcto; dada una pregunta libre, recupera el pasaje relevante antes de
> responder; nunca responde sin cita cuando hay contenido bíblico relevante. Con tests.
>
> Apenas #7 mergee avisás al canal — es la señal de arranque de la Oleada 3 para los
> otros dos.

---

## Dev A — Track A (Home, Sentimiento, Historias)

> **Tu cola esta semana, en este orden: #10 → #11 → #24.**
>
> Ninguno necesita el RAG, así que no dependés de B para arrancar hoy.
>
> - **#10 — notificación push diaria configurable.** El contenido ya existe
>   (`convex/devotional.ts` + `convex/crons.ts`, issue #9 mergeado).
> - **#11 — compartir Home por WhatsApp.** `src/lib/share.ts` **ya existe** (#36, lo hizo
>   Dev C). Lo llamás, no escribís una variante local. Si le falta algo, se lo pedís a C
>   y se extiende ahí — no se copia. Es la regla dura #3 de `CLAUDE.md`.
> - **#24 — cuota "1 muestra gratis" de por vida.** `convex/quotas.ts` **ya existe**
>   (lo hizo Dev B con #4). Mismo trato: lo llamás, no lo reimplementás. El issue #32 de
>   la Oleada 4 conecta las 4 cuotas al paywall y solo funciona si las 4 pasan por ahí.
>
> **Cuando #7 mergee** (te avisa B) seguís con #28 → #29 (Sentimiento) → #25 → #26
> (Historias). Ojo: sos el track más cargado de la Oleada 3 con 4 issues; si a mitad de
> camino vas lento, avisá temprano — el plan ya contempla pasarle Historias a C.
>
> **Archivos tuyos:** `app/(tabs)/home.tsx`, `app/(tabs)/sentir.tsx`,
> `app/(tabs)/historias.tsx`, `convex/devotional.ts`, `convex/feelings.ts`,
> `convex/stories.ts`, y sos **dueño de `src/components/`** — si B o C necesitan un
> componente base, te lo piden a vos.
> **No toques:** `src/theme/tokens.ts` ni `design/tokens.json`. Si necesitás un color,
> tamaño o radio que no está, se decide en Claude Design y se re-exporta — regla dura #1,
> un PR que mete un hex a mano se rechaza.

---

## Dev C — Track C (Voces, transversales, paywall)

> **Tu cola esta semana: cerrar #34 → #35 → #30.**
>
> Voces (#18-#21) está bloqueado por #7, que está haciendo B. Para que no te quedés
> parado te paso **#30 (UI de paywall), que originalmente era de B.**
>
> - **#34 — cerrar ajustes.** Entró como esqueleto en el PR #52. Falta lo real: toggle de
>   versión bíblica que afecte el contenido citado en toda la app, modo oscuro suave con
>   la paleta del prototipo, y hora de recordatorio (coordiná el guardado con Dev A, que
>   está haciendo #10).
> - **#35 — borrar historial.** Borrado de verdad, no un flag `deleted: true`. Es una
>   promesa de privacidad explícita del PRD.
> - **#30 — UI de paywall ($4.99/mes, features Pro listadas).** Es UI pura y sale del
>   prototipo. `convex/entitlements.ts` y `src/lib/revenuecat.ts` ya existen (#4, los hizo
>   B) — los consumís, no los editás. `app/paywall.tsx` no existe todavía, así que el
>   archivo es tuyo sin solape. La compra real (#31) y el restore (#33) siguen siendo de B
>   en la Oleada 4.
>
> **Cuando #7 mergee** arrancás Voces: #18 → #19 → #20 → #21.
>
> **Lo más importante que vas a hacer en el proyecto es #19** — el guardrail de que
> Moisés/David/Pablo hablan en 1ra persona pero **Jesús, Dios y el Espíritu Santo nunca**.
> Es una línea de producto, no una preferencia de diseño. **Escribí la suite de tests
> adversariales antes que el prompt de #18**, no después: el test define el
> comportamiento. Si un test adversarial pasa en rojo, el PR no entra.
>
> **Archivos tuyos:** `app/(tabs)/voces.tsx`, `app/ajustes.tsx`, `app/paywall.tsx`,
> `convex/voices.ts`, `convex/history.ts`, y sos **dueño de `src/lib/share.ts`** — si A o
> B necesitan compartir algo distinto, te lo piden y lo extendés vos.
> **No toques:** `src/theme/tokens.ts`, `design/tokens.json`, `convex/quotas.ts`.

---

## Contexto común (mandalo una vez al canal)

> **Reglas de merge, desde hoy:**
>
> 1. `master` está protegido. Todo entra por PR, con `typecheck` y `test` en verde, y la
>    rama al día antes de mergear. Solo squash merge — un issue, un commit.
> 2. **Un PR por issue.** Un PR con 5 issues no se revisa, se aprueba a ciegas.
> 3. **Orden de merge cuando hay varios PRs abiertos** — no es por quién terminó primero,
>    es por quién desbloquea a más gente: (1) PRs de solo `schema.ts`, (2) transversales
>    e infra, (3) ruta crítica, (4) features de módulo, (5) docs. Dentro de la misma
>    clase, FIFO: el que abrió primero mergea, el segundo rebasa.
> 4. **Un solo PR a la vez puede tocar un archivo compartido**
>    (`convex/schema.ts`, `_generated/`, `tokens.ts`, `app/_layout.tsx`, `quotas.ts`,
>    `share.ts`, `src/components/`). Antes de tocar uno, comentá en tu issue "tomo
>    `<archivo>`" y liberalo al mergear. Lock social de 10 segundos que evita el merge de
>    40 minutos.
> 5. **`convex/_generated/` no se resuelve a mano** — se regenera con `npx convex dev --once`.
> 6. **Ventana de merge diaria.** Todo lo listo entra junto, en el orden de arriba, y cada
>    uno rebasa una vez al día en vez de tres. Después de la ventana: `git pull` en tu
>    worktree antes de seguir.
>
> El plan completo está en `master-plan.md` — colas por track, mapa de solape de archivos
> y oleadas. Las reglas duras del producto están en `CLAUDE.md`; leelas antes del primer
> PR, sobre todo la #1 (toda UI sale del prototipo) y la #3 (los transversales tienen un
> solo dueño).
