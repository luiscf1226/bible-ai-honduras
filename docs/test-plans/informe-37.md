# Informe #37 — E2E dispositivo (consolidado por Dev C)

Estado: **QA visual Q&A + modo noche aplicados en código; dispositivo real pendiente (Carril A iOS bloqueado).**
Fecha: 2026-08-25. Commit de referencia: `origin/master` (local `track-c/37-e2e` iba 8 commits atrás al arrancar).

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

Comparado `app/(tabs)/preguntar.tsx` y `preguntar/chat.tsx` con `isQAPick` / `isQAChat` en `design/Bible AI Honduras.dc.html`. Confirmar en dispositivo (pasos §6 del plan).

| Superficie | Prototipo | App | Veredicto |
|---|---|---|---|
| Flujo libro → cap → versículo | 3 pasos | 3 pasos | Alineado |
| CTA «Prefiero preguntar directo, sin elegir pasaje» | Dashed, 13.5px, `#8E857A` | Mismo copy, dashed, `inkSoft` | Alineado |
| Título del picker | «¿Sobre qué pasaje?» (20px) + subtítulo indentado | Título dinámico 20px (`qaPickTitle`) + subtítulo por paso | **Alineado** |
| Subtítulos cap/versículo | «Elige el capítulo.» / «Toca los versículos…» | Subtítulo dinámico por paso | **Alineado** |
| Grilla de capítulos | 5 columnas, celdas cuadradas | 5 cols (`grid.chapterColumns`), tamaño cuadrado vía `useWindowDimensions` | **Alineado** |
| Selección de versículo | Multi-tap + sticky ask | Tap versículo navega al chat; sticky «Preguntar sobre…» capítulo | **Gap de interacción** (API solo 1 versículo) |
| Chat header | Contexto + cuota | Contexto + `N de 5 preguntas gratis hoy` | Alineado |
| Burbuja AI | Garamond 17.5 + card cita | Serif `aiBubble` 17.5 + `surfaceSunk` | **Alineado** |
| Disclaimer | «La IA puede equivocarse» junto a Compartir | Presente junto a «Compartir» | **Alineado** |
| Label compartir | «Compartir» | «Compartir» | **Alineado** |
| Chips sugeridos | 3 chips fijos | 3 chips del prototipo en composer | **Alineado** |
| Placeholder composer | «Escribe tu pregunta…» | Igual | Alineado |
| Typing | «Buscando en el texto…» | Igual | Alineado |
| Límite | `isLimit` único | `LimitReached` compartido (`module: "qa"`) | **Alineado** |
| Tab bar inferior | Hoy / Preguntar / Voces / Historias | Sin tabs (navegación desde Home) | **Gap de app** (fuera de Q&A) |

Literales vs tokens: back 34, grilla 5-col, switch 46×28, send 30 — todos tokenizados en `design/tokens.json`. Auth/onboarding siguen paleta día (pre-login).

Modo noche suave: `useTheme()` en Home, Q&A, Voces, Sentir, Historias, Ajustes, Historial, `LimitReached`, `AppButton`, `Brand`, `StoryPanels`. Paywall mantiene paleta propia.

---

## 3. Hallazgos transversales (código, no dispositivo)

| ID | Track | Hallazgo | Bloquea #37? |
|---|---|---|---|
| H1 | App | `app.json` sin `ios.bundleIdentifier`; no hay carpeta `ios/` ni `eas.json` | **Sí** — no se firma development build / IAP iOS |
| H2 | C/B | Historias va a `/paywall` directo (no `LimitReached`) | No si el paywall abre |
| H3 | Paywall | Compra real exige Test Store + webhook + **development build** | Sí para criterio «pago en cada plataforma» |
| H4 | Clerk | Hace falta publishable key del dashboard | Sí para cualquier tester sin `.env.local` |
| H5 | Lab | 2026-08-25: `xcrun xctrace` no lista iPhone físico; solo simuladores. Este workspace no tiene `.env.local` | **Sí** para Carril A |

---

## 4. Resultados dispositivo

### Carril A — iOS (dispositivo real)

Intento 2026-08-25. **Ningún caso se ejecutó en iPhone.** El plan marca compra-en-simulador como FAIL (#37 §10); no se sustituyó por Simulator / Expo Go.

| Caso | iOS | Notas |
|---|---|---|
| Onboarding: splash → auth (Google/Apple/email) → notificación → home | BLOCKED | H1 + H4 + H5. Flujo en código: `splash` → `login` (Google/Apple/email) → `onboarding` → `notifications` → `home` |
| Home: versículo → expandir → WhatsApp | BLOCKED | `home-devotional-toggle` + `home-share-devotional` vía `shareContent` |
| Q&A: libro/cap/versículo + pregunta libre → cita | BLOCKED | Confirmar §2 en device cuando desbloquee |
| Voces: chat humano + rechazo Jesús/Dios/Espíritu Santo | BLOCKED | Guardrail unitario verde; falta runtime |
| Historias: generar → visor de paneles | BLOCKED | 2ª muestra free va a `/paywall` directo (H2) |
| Sentimiento: selector + texto libre → devocional + oración | BLOCKED | Cupo 3 (`QUOTA_LIMITS.feelings`) |
| Agotar cuota en los 4 módulos → paywall | BLOCKED | Q&A 5, Voces 5, Sentir 3, Historias 1 (lifetime). Q&A usa `QaLimitScreen` local; Historias salta `LimitReached` |
| Compra sandbox $4.99 → desbloqueo de los 4 | BLOCKED | H1 + H3. Paywall muestra `$4.99`; checkout exige Test Store + webhook + dev build |
| Restaurar compra | BLOCKED | `paywall-restore` → `restorePurchases`; misma dependencia de dev build |

Para desbloquear (humano, sin inventar bundle id en este PR):

1. Conectar un iPhone y autorizar desarrollo.
2. Tech lead confirma `ios.bundleIdentifier` (Android ya es `com.bibleaihonduras.app`).
3. Entregar `.env.local` (Clerk / Convex / RevenueCat Test Store) — no pegarlo en el issue.
4. Development build: `npx expo run:ios --device` o EAS. **No Expo Go.**
5. Cuenta Clerk nueva para no heredar cuota/Pro.

### Dev A

| Caso | iOS | Android | Notas |
|---|---|---|---|
| A1 Home devocional | BLOCKED | | Carril A — ver tabla de arriba |
| A2 Notificaciones | BLOCKED | | Pantalla pide hora 6/12/21; OS prompt al activar |
| A3 Sentir feliz | BLOCKED | | |
| A4 Límite sentir | BLOCKED | | 4º free → `LimitReached` → paywall |
| A5 Historias muestra | BLOCKED | | |
| A6 Share historia | BLOCKED | | |

### Dev B

| Caso | iOS | Android | Notas |
|---|---|---|---|
| B1 Pregunta con pasaje | BLOCKED | | Carril A |
| B2 Pregunta libre | BLOCKED | | CTA «Prefiero preguntar directo…» |
| B3 Límite Q&A | BLOCKED | | 6ª → `QaLimitScreen` local, no `LimitReached` |
| B4 Share Q&A | BLOCKED | | |

### Dev C

| Caso | iOS | Android | Notas |
|---|---|---|---|
| C1–C5 Voces | BLOCKED | | Carril A |
| C6 Ajustes | BLOCKED | | Fuera del checklist A; sigue pendiente |
| C7 Compra | BLOCKED | | |
| C8 Restore | BLOCKED | | |
| Visual Q&A (confirmar §2) | BLOCKED | | |

---

## 5. Criterio de cierre

- [ ] iOS real: onboarding → 5 módulos → un límite → paywall
- [ ] Android real: lo mismo
- [ ] Compra sandbox en **al menos un dispositivo de cada plataforma**
- [ ] Guardrail Voces en rojo no habla como Jesús/Dios
- [ ] QA visual Q&A contrastado; gaps de §2 aceptados o filados

Hasta que A/B/C no firmen dispositivo, **#37 no se cierra**.
