# Plan maestro v2 — Bible AI Honduras (2-3 devs en paralelo)

**Repo:** github.com/luiscf1226/bible-ai-honduras · **Fuente:** `phases.md` + `ARCHITECTURE.md` + 39 issues en 10 milestones.
**Concurrencia:** 3 colas (una por dev/worktree), con plan de caída a 2. Un dev = un track fijo durante todo el proyecto.

---

## 0. Estado real hoy (2026-08-24)

| Issue | Estado | Evidencia |
|---|---|---|
| #1 Scaffold Expo + navegación | ✅ hecho | PR #43, `app/(tabs)/*`, `app/(auth)/*` |
| #2 Sistema de diseño | ✅ hecho | PR #44, `design/tokens.json`, `src/theme/tokens.ts` |
| #3 Backend auth + usuario | ✅ hecho | PR #46, `convex/auth.config.ts`, `convex/users.ts` |
| #9 Fuente de devocional diario | ✅ hecho | PR #47, `convex/devotional.ts`, `crons.ts` |
| #22 Spike de imágenes | ✅ hecho | PR #45, informe en `docs/` |
| #4 RevenueCat sandbox | ⬜ pendiente | — |
| resto (#5-#8, #10-#21, #23-#39) | ⬜ pendiente | — |

**Cerrar en GitHub #2, #3, #9 y #22** — están mergeados pero siguen abiertos y ensucian el conteo de la cola.

Fase 0 está prácticamente cerrada salvo #4. Eso significa que **arrancamos directo en la Oleada 2**.

---

## 1. Mapa de solape de archivos (esto define los tracks, no el gusto)

Antes de repartir: qué archivo toca cada issue. Dos issues que comparten archivo **no van en tracks paralelos** — van en la misma cola, ordenados.

### 1a. Archivos compartidos por todos (zona de conflicto)

| Archivo | Quién lo necesita | Regla |
|---|---|---|
| `convex/schema.ts` | casi todos los issues de backend | **Append-only y en PR propio.** Cada track agrega su bloque de tablas en un PR de 10 líneas que se mergea primero, antes del PR de la feature. Nadie reordena ni reformatea tablas ajenas. |
| `convex/_generated/*` | todos | Generado. Se regenera en cada merge; conflicto aquí se resuelve con `npx convex dev --once`, nunca a mano. |
| `src/theme/tokens.ts`, `design/tokens.json` | todos los de UI | **Congelado.** Solo se cambia re-exportando desde Claude Design (regla dura #1). Un PR de feature que lo toca se rechaza. |
| `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | quien agregue ruta nueva | Dueño único: **Track A**. B y C piden el registro de ruta a A o lo mandan como PR aparte de 3 líneas. |
| `convex/quotas.ts` | #15 #20 #24 #29 | **Servicio único, dueño Track B.** Se construye en la Oleada 2, antes que los módulos. Nadie escribe una variante local (regla dura #3). |
| `src/lib/share.ts` (#36) | #11 #16 #21 #26 | **Componente único, dueño Track C.** Se adelanta a la Oleada 2 por la misma razón. |
| `src/components/*` (base) | todos | Track A es dueño de la librería base. B y C consumen; si falta un componente, se pide a A — no se crea un primo local. |

### 1b. Archivos con dueño exclusivo (aquí sí hay paralelismo real)

| Superficie | Issues | Track |
|---|---|---|
| `convex/rag/*` (`embed`, `ingest`, `commentary`, `retrieve`, `answer`, `prompts/`) | #5 #6 #7 | **B** |
| `convex/qa.ts`, `app/(tabs)/preguntar/*` | #12 #13 #14 #15 #16 | **B** |
| `convex/entitlements.ts`, `convex/http.ts`, `app/paywall.tsx`, `src/lib/revenuecat.ts` | #4 #30 #31 #32 #33 | **B** |
| `convex/devotional.ts`, `app/(tabs)/home.tsx`, push | #8 #10 #11 | **A** |
| `convex/feelings.ts`, `app/(tabs)/sentir/*` | #27 #28 #29 | **A** |
| `convex/stories.ts`, `app/(tabs)/historias/*` | #23 #24 #25 #26 | **A** |
| `convex/voices.ts` + `convex/rag/prompts/voices.ts`, `app/(tabs)/voces/*` | #17 #18 #19 #20 #21 | **C** |
| `convex/history.ts`, `app/ajustes.tsx`, `src/lib/share.ts` | #34 #35 #36 | **C** |

**Issues sin superficie declarada:** #37 (E2E), #38 (materiales de tienda), #39 (lanzamiento). No son paralelizables como código — se hacen al final, con dueño nombrado.

---

## 2. Los 3 tracks

| Track | Dueño de | Carga | Perfil |
|---|---|---|---|
| **A — Producto & contenido** | Home, Sentimiento, Historias, componentes base, rutas | 11 issues | Más UI, más pantallas, mayor volumen |
| **B — Motor & dinero** | RAG, quotas, Q&A, RevenueCat/paywall | 13 issues | El más técnico; RAG bloquea a A y C, así que es la ruta crítica |
| **C — Voces & transversales** | Voces, compartir, ajustes/privacidad | 8 issues + QA | UI conversacional + guardrail + la fase transversal |

Si solo hay 2 devs: ver §5.

### 2b. Listado completo — los 34 issues pendientes repartidos

**Track A — Producto & contenido (11 issues)**

| Oleada | Issues |
|---|---|
| O2 | #8 UI Home · #10 Push diaria · #11 Compartir Home |
| O3 | #27 Selector de sentimiento · #28 Generación por sentimiento · #29 Historial+cuota Sentimiento · #23 Catálogo de historias · #24 Cuota 1 muestra · #25 Visor de historia · #26 Compartir historia |
| O5 | #38 Materiales de tienda |

**Track B — Motor & dinero (13 issues) · ruta crítica**

| Oleada | Issues |
|---|---|
| O2 | #5 Ingesta RVR1960 · #6 Comentarios evangélicos · #7 Función RAG · #4 RevenueCat sandbox *(+ `quotas.ts`, infra adelantada de #15)* |
| O3 | #12 Selector de pasaje · #13 Pregunta libre · #14 UI de chat Q&A · #15 Cuota Q&A · #16 Compartir Q&A |
| O4 | #30 UI de paywall · #31 Compra + entitlement · #32 Conectar los 4 límites · #33 Restaurar compra |

**Track C — Voces & transversales (8 issues)**

| Oleada | Issues |
|---|---|
| O2 | #36 Componente de compartir · #17 Lista de personajes · #34 Ajustes *(esqueleto; cierra en O4)* |
| O3 | #18 Chat 1ra persona · #19 Guardrail duro · #20 Cuota Voces · #21 Compartir cita |
| O4 | #35 Borrar historial |

**Compartidos (2 issues):** #37 E2E (los 3) · #39 Lanzamiento suave (fundador).

### 2c. Cuántos en paralelo

**Máximo 3 issues en vuelo a la vez** — WIP de 1 por dev. Más que eso y el review se vuelve el cuello de botella, no el código.

| Oleada | Issues en la oleada | A / B / C | Duración | Paralelismo real |
|---|---|---|---|---|
| **O2** | 10 | 3 / 4 / 3 | ~1.5-2 sem | 3 tracks, 0 bloqueos cruzados |
| **O3** | 16 | 7 / 5 / 4 | ~2.5-3 sem | 3 tracks, todos consumiendo #7 ya mergeado |
| **O4** | 5 | 0 / 4 / 1 | ~1 sem | 2 tracks; A queda libre para refuerzo |
| **O5** | 3 | — | ~1 sem | los 3 sobre #37 |
| | **34** | **11 / 13 / 8** | **~6-7 sem** | |

O3 es la oleada desbalanceada: A lleva 7 issues contra 4 de C. El reequilibrio ya está definido — mover Historias (#23-#26) a C en cuanto A cierre Sentimiento.

---

## 3. Las colas (orden dentro de cada track — se ejecutan de arriba abajo, sin saltarse)

### Oleada 2 — desbloquear la ruta crítica (~1.5-2 semanas)

| Track | Cola ordenada | Depende de | Por qué en este orden |
|---|---|---|---|
| **B** | `#5` → `#6` → `#7` → **`quotas.ts`** (infra de #15/#20/#24/#29) → `#4` | nada (Fase 0 lista) | #7 es lo que desbloquea a A y C. Sale primero, todo lo demás de B espera. |
| **A** | `#8` → `#10` → `#11` (usa el share de C) | #2, #9 ✅ | Home no necesita RAG — es el trabajo real que existe mientras B construye el motor. |
| **C** | **`#36`** (componente de compartir) → `#17` (lista de personajes, es UI pura) → `#34` (esqueleto de ajustes) | #2 ✅ | #36 adelantado: cuatro módulos lo van a llamar en la Oleada 3; si llega tarde, cuatro devs se inventan su propia versión. |

**Cambio clave vs. el plan v1:** `quotas.ts` (#15/#20/#24/#29) y `share.ts` (#36) se construyen **aquí**, no en la Oleada 4. Son los dos transversales de la regla dura #3; construirlos después de los módulos garantiza cuatro implementaciones locales que después hay que arrancar a mano.

**Salida de la oleada:** RAG responde con cita verificada; `quotas.check()` y `share()` existen y están documentados; Home navegable con devocional real; RevenueCat en sandbox.

---

### Oleada 3 — los 4 módulos, en paralelo real (~2.5-3 semanas)

| Track | Cola ordenada | Depende de |
|---|---|---|
| **B** | `#12` → `#13` → `#14` → `#15` → `#16` (Q&A completo) | #7 (propio), quotas, #36 |
| **C** | `#18` → **`#19`** → `#20` → `#21` (Voces) | #7 (de B), #17 (propio), quotas, #36 |
| **A** | `#27` → `#28` → `#29` (Sentimiento) → `#23` → `#24` → `#25` → `#26` (Historias) | #7 (de B), #22 ✅, quotas, #36 |

**Riesgos de esta oleada:**
- **#19 es el issue de mayor riesgo reputacional del proyecto.** Guardrail duro: nunca Jesús/Dios/Espíritu Santo en 1ra persona. No se mergea sin la suite de tests adversariales en verde (regla dura #2). Bloquea a #18 en la práctica: se escribe el test antes que el prompt.
- **A va cargado** (7 issues). Si al cerrar Sentimiento la Oleada 3 lleva más de 2 semanas, **mover Historias (#23-#26) a C** — C queda libre después de #21 y `convex/stories.ts` no toca nada de C. Es el corte más limpio del plan.
- **Historias es lo más recortable** si el calendario aprieta (`phases.md`, nota de riesgo de Fase 5): es la única fase que se puede reducir a "1 historia pregenerada" sin romper nada más.

**Salida:** los 4 módulos con cuota gratis/Pro y compartir funcionando de punta a punta.

---

### Oleada 4 — convergencia (~1 semana)

| Track | Cola | Depende de |
|---|---|---|
| **B** | `#30` → `#31` → `#32` → `#33` | #4 (propio), y que las 4 cuotas existan (#15 #20 #24 #29) |
| **C** | `#35` → cerrar `#34` (versión bíblica + modo oscuro + hora) | modelos de datos de los 4 módulos |
| **A** | Pulido de Historias/Sentimiento, o refuerzo a B/C | — |

`#32` es el punto donde los 3 tracks se cruzan: conecta los 4 "límite alcanzado" al paywall. Solo funciona si nadie hizo su propia cuota local. Es la validación de la regla dura #3.

---

### Oleada 5 — cierre (~1 semana)

| Issue | Dueño |
|---|---|
| `#37` E2E en dispositivo real | los 3, cada uno prueba lo que construyó; C consolida el informe |
| `#38` materiales de tienda | A (o quien tenga menos carga) |
| `#39` lanzamiento suave | el fundador |

---

## 4. Protocolo de merge (lo que evita que 3 colas se pisen)

### 4a. Orden de merge cuando hay varios PRs abiertos a la vez

Con 3 devs esto pasa todos los días: 3 PRs abiertos al mismo tiempo. **El orden no es
por quién terminó primero — es por quién desbloquea a más gente.** Prioridad de merge:

| Prioridad | Clase de PR | Ejemplos | Por qué primero |
|---|---|---|---|
| **1** | Schema (`convex/schema.ts` solo) | agregar tabla `usage`, `conversations` | Es de 10 líneas, se revisa en 2 minutos y todos los demás PRs lo necesitan para rebasar limpio |
| **2** | Transversal / infra | `quotas.ts`, `share.ts` (#36), componentes base, registro de ruta en `_layout.tsx` | N consumidores esperando. Un día de retraso acá = 3 devs bloqueados |
| **3** | Ruta crítica | todo lo de Track B en O2 (#5, #6, #7) | A y C no pueden empezar la O3 hasta que #7 esté en `master` |
| **4** | Feature de módulo | #8, #18, #27, #25… | Solo se afectan a sí mismos |
| **5** | Docs / informes | spikes, README | Nunca bloquean a nadie; entran al final del día |

**Dentro de la misma clase: FIFO.** El que abrió primero mergea primero; el segundo
rebasa. No se negocia por antigüedad del dev ni por tamaño del PR.

### 4b. La regla que evita el 90% de los conflictos

**Un solo PR a la vez puede tocar un archivo compartido.** Si el PR de A ya toca
`convex/schema.ts`, el de C espera a que A mergee y luego rebasa. Cómo se coordina sin
reuniones: quien va a tocar un archivo de la tabla §1a **comenta en su issue "tomo
`schema.ts`"** antes de empezar, y lo libera al mergear. Es un lock social, cuesta 10
segundos y evita el merge de 40 minutos.

### 4c. Serialización mecánica (hoy no existe — hay que ponerla)

`master` **no tiene branch protection ni CI**. Con 1 dev daba igual; con 3 es el agujero
del plan. Antes de arrancar la Oleada 2:

1. **Workflow de CI** (`.github/workflows/ci.yml`): `npm ci` → `npm run typecheck` → `npm test`.
2. **Branch protection en `master`:**
   - ✅ Require a pull request before merging (1 aprobación)
   - ✅ Require status checks to pass → `typecheck`, `test`
   - ✅ **Require branches to be up to date before merging** ← esta es la clave: obliga a
     que el segundo PR rebase sobre el primero. Sin ella, dos PRs verdes por separado
     rompen `master` juntos.
3. **Squash merge como única opción.** Un issue = un commit en `master`. El historial
   queda legible y revertir un issue es un solo `git revert`.

Opcional si el ida y vuelta de rebases molesta: activar **merge queue** de GitHub, que
hace exactamente esto en automático (rebasa y prueba cada PR contra el resultado del
anterior).

### 4d. Cadencia

**Ventana de merge diaria**, no merges a cualquier hora. Todos los PRs listos entran en
la misma ventana, en el orden de §4a, y cada dev rebasa una sola vez al día en vez de
tres. Después de la ventana: `git pull` obligatorio en los 3 worktrees antes de seguir.

### 4e. Reglas de higiene

1. **Un worktree por track**, rama `track-<a|b|c>/<issue>`. Nadie edita fuera del scope declarado en su sub-plan.
2. **Cambios de `convex/schema.ts` van en su propio PR**, mergeado antes del PR de la feature. Regla: append-only.
3. **PR pequeño por issue**, no por módulo. Un PR de 5 issues no se revisa, se aprueba a ciegas.
4. **Rebase sobre `master` antes de abrir PR.** El conflicto barato es el que se resuelve en tu worktree.
5. **`convex/_generated` no se resuelve a mano** — se regenera.
6. **Nadie mergea a `master` con la app rota**: `npx tsc --noEmit` + `vitest` en verde es el mínimo.

---

## 5. Si solo hay 2 devs

No colapses B dentro de A (eso serializa RAG antes de Home y mata la Oleada 2). El corte correcto:

| Dev | Track |
|---|---|
| **Dev 1** | B completo (RAG → quotas → Q&A → paywall) — la ruta crítica, sin desviarse |
| **Dev 2** | A + C fusionados, en este orden: `#36` → `#8`/`#10`/`#11` → `#17` → `#18`/`#19`/`#20`/`#21` → `#27`/`#28`/`#29` → `#34`/`#35` |

Y **recortá Historias (#23-#26) a v1.1**. Con 2 devs no da el calendario y es la fase que `phases.md` ya marca como la más defendible de recortar. Decirlo ahora es barato; descubrirlo en la semana 8 no.

---

## 6. Siguiente paso

Los sub-planes por issue (goal, archivos en scope, fuera de scope, enfoque, depends-on, plan de pruebas, evidencia) no están escritos. El orden natural: generarlos para la **Oleada 2** (#5, #6, #7, quotas, #4, #8, #10, #11, #36, #17) y dejar la Oleada 3 para cuando #7 esté mergeado y se sepa qué forma real tiene la API del RAG.
