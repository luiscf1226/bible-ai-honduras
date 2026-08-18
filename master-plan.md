# Plan maestro — Bible AI Honduras (3 agentes en paralelo)

**Repo:** github.com/luiscf1226/bible-ai-honduras · **Fuente:** `phases.md` (fases/dependencias) + 39 issues ya creados en 10 milestones.
**Concurrencia:** 3 worktrees/agentes, con caída a 2 si hace falta (ver nota al final).
**Orquestador:** tú, supervisando los 3 agentes con Claude Code.

---

## Los 3 tracks (identidad fija de cada agente durante todo el proyecto)

| Track | Dueño de | Perfil de trabajo |
|---|---|---|
| **A — Núcleo & Experiencia guiada** | Fase 0 (parte), Home, Sentimiento, Historias ilustradas | UI + lógica de producto, mayor carga total |
| **B — Motor RAG & Q&A & Paywall** | Fase 0 (parte), RAG, Q&A, Paywall | El más técnico/backend — RAG es la pieza que bloquea a todos los demás |
| **C — Voces & Ajustes/Privacidad** | Fase 0 (parte), Voces, Ajustes/compartir | UI conversacional + la fase transversal final |

Cada agente trabaja en su propio worktree; ningún agente toca archivos fuera del scope de su issue actual.

---

## Oleadas

### Oleada 1 — Fase 0 (sin dependencias entre sí, arrancan los 3 a la vez)

| Track | Issues |
|---|---|
| A | #1 Scaffold Expo RN + navegación, #2 Sistema de diseño |
| B | #3 Backend: auth + almacenamiento |
| C | #4 RevenueCat sandbox |

**Salida de la oleada:** app corre con navegación básica, backend responde, compra de prueba funciona.

### Oleada 2

| Track | Issues | Depende de |
|---|---|---|
| A | #8, #9, #10, #11 (Home) | #1, #2 (propio) |
| B | #5, #6, #7 (RAG) | #3 (propio) |
| C | #22 (spike de generación de imágenes) | #3 (de B — esperar a que termine oleada 1) |

**Salida de la oleada:** Home navegable con devocional real; RAG respondiendo con cita; proveedor de imágenes elegido con costo/latencia medidos.

### Oleada 3 — la más cargada, los 4 módulos restantes

| Track | Issues | Depende de |
|---|---|---|
| A | #27, #28, #29 (Sentimiento) → luego #23, #24, #25, #26 (Historias) | #7 (de B), #22 (propio) |
| B | #12, #13, #14, #15, #16 (Q&A) | #7 (propio) |
| C | #17, #18, #19, #20, #21 (Voces) | #7 (de B) |

**Punto de atención:** #19 (guardrail duro — nunca Jesús/Dios/Espíritu Santo en 1ra persona) es el issue de mayor riesgo reputacional del proyecto entero. No lo dejes pasar sin la prueba automatizada que pide su criterio de aceptación.

**Salida de la oleada:** los 4 módulos con cuota gratis/Pro funcionando de punta a punta.

### Oleada 4 — convergencia (paywall + transversal)

| Track | Issues | Depende de |
|---|---|---|
| B | #30, #31, #32, #33 (Paywall) | #4 (C, oleada 1), #15 (B), #20 (C), #24 (A), #29 (A) |
| C | #34, #35, #36 (Ajustes, privacidad, compartir) | #9/#10 (A), #14 (B), #18 (C), #28 (A) |
| A | Libre — puede adelantar pulido de Historias/Sentimiento o ayudar a B/C si van atrasados |

**Nota:** esta es la oleada donde los 3 tracks se cruzan de verdad — no arranca hasta que la oleada 3 esté completa en los 4 módulos, porque #32 necesita las 4 cuotas y #36 necesita los 4 botones de compartir.

### Oleada 5 — Fase 9, cierre conjunto

| Track | Issues |
|---|---|
| Todos | #37 (E2E — cada track prueba lo que construyó) |
| A (o quien tenga menos carga) | #38 (materiales de tienda), #39 (lanzamiento suave) |

---

## Carga total estimada por track

| Track | Issues totales |
|---|---|
| A | 15 |
| B | 13 |
| C | 11 |

Ligeramente desbalanceado hacia A porque tiene 2 módulos completos (Sentimiento + Historias) — si en oleada 3 A se atrasa, mover Historias (#23-26) a C es el ajuste más limpio, ya que C solo tiene Voces en esa oleada.

---

## Si prefieres 2 agentes en vez de 3

Colapsa **B** dentro de **A** (A pasa a dueño de Núcleo + RAG + Q&A + Paywall) y deja **C** como está (Voces + Ajustes). Pierdes paralelismo en la oleada 2-3 porque A tendría que hacer RAG antes de poder tocar Home/Sentimiento en serio — el plan de 3 tracks existe específicamente para no pagar ese costo.

---

## Siguiente paso

Este es el plan maestro (para tu revisión). Los sub-planes por issue (goal, archivos en scope, fuera de scope, enfoque, plan de pruebas) no están escritos todavía — dime si quieres que los genere para los issues de la Oleada 1 primero, o para todos de una vez.
