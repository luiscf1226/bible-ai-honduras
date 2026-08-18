# Bible AI Honduras

App móvil Expo React Native (iOS + Android) — devocional diario, Q&A bíblico con RAG,
chat con personajes bíblicos, y generador de historias ilustradas. Freemium, $4.99/mes
vía RevenueCat. Mercado: Honduras, público evangélico/protestante. **Idioma del producto
y de los issues: español.**

- Producto y alcance: `PRD.md`
- Fases, dependencias y orden de ejecución: `phases.md`
- **Prototipo de UI (contrato visual): `design/Bible AI Honduras.dc.html`**

---

## Regla dura #1 — Toda UI sale de Claude Design

El prototipo en `design/` **no es una referencia suelta, es el contrato visual del v1.**

Antes de escribir o modificar cualquier pantalla, componente, color, tipografía o
espaciado:

1. Abrí el prototipo (`cd design && python3 -m http.server 8899`) y localizá la
   pantalla que estás construyendo.
2. Usá `design/tokens.json`. **Nunca escribas un hex, un tamaño de fuente o un radio
   literal en un componente** — siempre a través del token.
3. Si el componente que necesitás **no existe en el prototipo**, no lo inventes en el
   editor. Se decide primero en Claude Design
   (https://claude.ai/design/p/d47cead9-1ae1-42f9-90f8-05f74c8eec8d), se re-exporta a
   `design/`, y recién después se codea. Si estás bloqueado, preguntá — no improvises.

Un PR de frontend que introduce color, tipografía o espaciado que no está en
`design/tokens.json` se rechaza. La justificación no es estética: son 4 módulos
construidos en paralelo por personas distintas y el prototipo es lo único que los
mantiene viéndose como una sola app.

Detalle y tabla de tokens: `design/README.md`.

## Regla dura #2 — Solo personajes humanos en 1ra persona

Moisés, David, Pablo, Ester, Rut, Elías, Daniel — sí. **Jesús, Dios y el Espíritu Santo
nunca se encarnan en 1ra persona**; de ellos se habla en 3ra persona. Es una línea de
producto, no una sugerencia de diseño (`PRD.md` §4.3). Cualquier cambio al prompt del
módulo de Voces tiene que dejar la suite de tests adversariales del issue #19 en verde.

## Regla dura #3 — Los transversales tienen un solo dueño

**Cuotas free/Pro** (issues #15, #20, #24, #29) y **compartir por WhatsApp** (#36 →
#11, #16, #21, #26) son **un servicio y un componente**, con N llamadas. Si tu módulo
necesita límite de uso o compartir, llamás al existente. No implementes una variante
local "rápida" — eso rompe el issue #32 (conectar los 4 límites al paywall).

## Regla dura #4 — Todo contenido bíblico va anclado al RAG

La IA no emite opinión teológica libre. Toda respuesta de Q&A, Voces y Sentimiento sale
del pipeline de RAG con cita verificable al texto (RVR1960) y comentarios evangélicos.
Si una feature necesita generación libre, se discute antes de construirla.

---

## Convenciones

- Stack: Expo / React Native, TypeScript.
- Copy de la app en español de Honduras. No traduzcas los issues ni los docs al inglés.
- Los issues de GitHub son la unidad de trabajo; el orden y las dependencias están en
  `phases.md`.
