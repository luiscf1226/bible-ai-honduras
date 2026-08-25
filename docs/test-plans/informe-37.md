# Informe #37 — E2E dispositivo (consolidado por Dev C)

Estado: **plan publicado; QA visual de Q&A hecho desde código; dispositivo real pendiente.**
Fecha: 2026-08-24. Commit de referencia: `origin/master`.

Los testers pegan PASS/FAIL en las tablas. C actualiza este archivo al cerrar la ronda.

---

## 1. Cómo se prueba

Plan paso a paso: `docs/test-plans/e2e-ios-android-demo.md`.

- A → Home, notificaciones, Sentir, Historias
- B → flujo Q&A (funcional)
- C → Voces, ajustes, paywall, guardrail + **QA visual Q&A vs prototipo** (B no tenía Clerk)

Devolver resultados como comentario en #37 o editando las tablas de abajo.

---

## 2. QA visual Q&A vs prototipo (C, desde código)

Comparado `app/(tabs)/preguntar.tsx` y `preguntar/chat.tsx` con `isQAPick` / `isQAChat` en `design/Bible AI Honduras.dc.html`. Sin Clerk en este entorno no hay screenshots de runtime; esto hay que **confirmar en dispositivo** (pasos §6 del plan).

| Superficie | Prototipo | App | Veredicto |
|---|---|---|---|
| Flujo libro → cap → versículo | 3 pasos | 3 pasos | Alineado |
| CTA «Prefiero preguntar directo, sin elegir pasaje» | Dashed, 13.5px, `#8E857A` | Mismo copy, `borderStyle: dashed`, `inkSoft` | Alineado |
| Título del picker | «¿Sobre qué pasaje?» (20px) + subtítulo 13px a 46px | «Elige un libro» (`type.title` 25px), **sin subtítulo** | **Gap** |
| Subtítulos cap/versículo | «Elige el capítulo.» / «Toca los versículos…» | No hay | **Gap** |
| Grilla de capítulos | 5 columnas, `aspect-ratio: 1` | `width: 18%`, `height: 52` (no cuadrado 5-col) | **Gap** |
| Selección de versículo | Multi-tap + sticky ask | Tap versículo **navega al chat**; hay ask de capítulo entero | **Gap de interacción** |
| Chat header | Contexto + cuota | Contexto + `N de 5 preguntas gratis hoy` | Alineado (cupo 5, no el 3 del prototipo — correcto, `QUOTA_LIMITS.qa`) |
| Burbuja AI | Garamond 17.5 + card cita `#F6F0E6` | Serif `body` 14.5 + `surfaceSunk` | Cerca; tamaño menor |
| Disclaimer | «La IA puede equivocarse» junto a Compartir | **No está** | **Gap** |
| Label compartir | «Compartir» | «Compartir esta respuesta» | Copy distinto |
| Chips sugeridos | «¿Quién lo escribió?» / «¿Cómo lo aplico hoy?» / «Explícalo más simple» | **No están** | **Gap** |
| Placeholder composer | «Escribe tu pregunta…» | Igual | Alineado |
| Typing | «Buscando en el texto…» | Igual | Alineado |
| Límite | `isLimit` único | `QaLimitScreen` **local** (no usa `LimitReached`); copy sin «el devocional del día sigue abierto» | **Gap** (#32) |
| Tab bar inferior | Hoy / Preguntar / Voces / Historias | **No hay tabs**; se vuelve al home | **Gap de app** (no solo Q&A) |

Literales vs tokens (regla dura #1): back 34×34 en Q&A (el prototipo mide 34px; en Voces se compuso con tokens). No bloquea E2E.

**Para dispositivo:** capturar picker (libros, caps, versos) y un chat con cita, al lado del prototipo. Confirmar o refutar los gaps.

---

## 3. Hallazgos transversales (código, no dispositivo)

| ID | Track | Hallazgo | Bloquea #37? |
|---|---|---|---|
| H1 | App | `app.json` sin `ios.bundleIdentifier` | Puede bloquear build iOS / IAP |
| H2 | C/B | Q&A no consume `LimitReached`; Historias va a `/paywall` directo | No si el paywall abre; sí vs prototipo `isLimit` |
| H3 | Paywall | Compra real exige Test Store + webhook + **development build** | Sí para criterio «pago en cada plataforma» |
| H4 | Clerk | Hace falta publishable key del dashboard | Sí para cualquier tester sin `.env.local` |

---

## 4. Resultados dispositivo

### Dev A

| Caso | iOS | Android | Notas |
|---|---|---|---|
| A1 Home devocional | | | |
| A2 Notificaciones | | | |
| A3 Sentir feliz | | | |
| A4 Límite sentir | | | |
| A5 Historias muestra | | | |
| A6 Share historia | | | |

### Dev B

| Caso | iOS | Android | Notas |
|---|---|---|---|
| B1 Pregunta con pasaje | | | |
| B2 Pregunta libre | | | |
| B3 Límite Q&A | | | |
| B4 Share Q&A | | | |

### Dev C

| Caso | iOS | Android | Notas |
|---|---|---|---|
| C1–C5 Voces | | | |
| C6 Ajustes | | | |
| C7 Compra | | | |
| C8 Restore | | | |
| Visual Q&A (confirmar §2) | | | |

---

## 5. Criterio de cierre

- [ ] iOS real: onboarding → 5 módulos → un límite → paywall
- [ ] Android real: lo mismo
- [ ] Compra sandbox en **al menos un dispositivo de cada plataforma**
- [ ] Guardrail Voces en rojo no habla como Jesús/Dios
- [ ] QA visual Q&A contrastado; gaps de §2 aceptados o filados

Hasta que A/B/C no firmen dispositivo, **#37 no se cierra**.
