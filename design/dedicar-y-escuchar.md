# Dedicar un versículo (#202) y escuchar el capítulo (#157) — especificación visual

> **Origen:** el fundador extendió (2026-10-03) a estos dos issues la decisión de
> la oleada UX (`design/oleada-ux.md`): se diseñan directo en el repo, sin la
> sesión de Claude Design. Este archivo es su contrato visual. Todo lo demás de
> la regla dura #1 sigue vigente: **cero hex, `fontSize`, `borderRadius` o
> padding literal en un componente.** Los tokens nuevos están en
> `design/tokens.json` y `src/theme/tokens.ts`.
>
> Vocabulario: el mismo del prototipo y de la oleada (tarjetas `surface` con
> borde `border`, títulos y versículos en EB Garamond, UI en DM Sans light,
> chips pill, acento `accent`). Nada de estilo nuevo.

## Tokens nuevos

| Token | Valor | Uso |
|---|---|---|
| `size.audioButton` | 44 | Botón redondo reproducir/pausar (área táctil mínima de iOS) |
| `size.audioProgress` | 2 | Línea de avance del capítulo en el control de audio |
| `size.dedicationPreview` | story 216 · square 280 | Ancho de la vista previa en `/dedicar` |
| `storyImage.squareHeight` | 1080 | Imagen cuadrada para el chat (1080×1080) |
| `storyImage.squarePaddingY` | 104 | Margen vertical de la cuadrada |
| `storyImage.dedicationTo` / `dedicationToMin` | 64 → 46 | "Para …", baja hasta entrar en un renglón (máx. 2) |
| `storyImage.dedicationMessage` | 40 | Dedicatoria (máx. 3 renglones) |
| `storyImage.dedicationVerseMin` | 36 | Tamaño mínimo del versículo dedicado (no se corta nunca) |
| `storyImage.dedicationRuleWidth` / `dedicationRule` | 120 × 3 | Filete `accent` entre "Para …" y la dedicatoria |

## Íconos

En `src/components/Icon.tsx`, mismo trazo de 1.3 sobre 24: `listen`
(auriculares), `play`, `pause`, `gift` (regalo, para "Dedicar").

---

## Escuchar el capítulo (#157)

- **Entrada:** en el encabezado del lector, a la izquierda de "Aa", botón
  circular `listen` (mismo `HeaderIconButton`). Empieza desde el versículo 1.
  Mientras suena, el ícono va en `accent` y tocarlo para la lectura.
- **Desde un versículo:** acción **Escuchar** (`listen`) en la hoja del
  versículo (registro `verseActions.ts`). Cierra la hoja y empieza ahí.
- **Control (`ListenBar`):** tarjeta al pie de la página, **no modal** (se
  sigue leyendo y deslizando). `surface`, borde `border`, radio `xxl`,
  `cardPadding.horizontal`, margen `screenPadding`. Fila: botón redondo
  `size.audioButton` fondo `ink` con `pause`/`play` en `surface` → texto con
  `ESCUCHANDO` / `EN PAUSA` en `overline` `accent` y "Salmos 46 · versículo 3"
  en `subtitle` serif `ink` → `close` `inkSoft` ("Dejar de escuchar"). Debajo,
  línea `size.audioProgress`: pista `border`, relleno `accent` hasta el
  versículo que suena.
- **En la página:** el versículo que suena lleva el fondo `highlightSand` (el
  mismo del versículo tocado) y la página hace scroll para que se vea.
- Mientras la hoja del versículo o "Aa" están abiertas, el control se esconde;
  el audio sigue.
- **Se corta** al cambiar de capítulo, al abrir otra pantalla encima y al salir
  del lector; se pausa si la app pasa a segundo plano.
- Voz del sistema (`expo-speech`): es-MX, después es-US, después cualquier
  español; entre iguales, la "Enhanced". Al empezar por el versículo 1 se
  anuncia "Salmos, capítulo 46.". El texto es el del corpus, sin cambios.

## Dedicar un versículo (#202)

### Entradas
- Hoja del versículo en el lector: acción **Dedicar** (`gift`).
- `/hoy`: fila **Dedicar este versículo** (`gift`) en la lista de acciones,
  antes de "Leer el capítulo completo".

### Pantalla `/dedicar`
`ScreenHeader` con título "Dedicar". `ScrollView` con `screenPadding`,
`gap: space.xl`:
1. **Vista previa** centrada: la misma imagen que se manda, a
   `size.dedicationPreview`, radio `lg` y borde `border`.
2. **PARA** (`overline` `accent`, contador `caption` `inkFaint` a la derecha):
   campo de una línea, radio `lg`, borde `borderStrong`, `body` light.
   Placeholder "Mi mamá, Don Chepe, mi célula…". Tope 28.
3. **DEDICATORIA · OPCIONAL**: mismo campo, multilínea. Placeholder
   "Gracias por enseñarme a orar.". Tope 90.
4. **PLANTILLA**: `FilterPills` con un punto del `accent` de cada plantilla.
5. **FORMATO**: `FilterPills` "Estado · 9:16" / "Chat · cuadrada". Si el
   versículo no entra entero en la cuadrada, solo se ofrece 9:16 con la nota
   "Este versículo es largo: para que entre entero, va en formato estado."
6. **Enviar por WhatsApp** (`AppButton` primario, `whatsapp`) — deshabilitado
   hasta que haya nombre. Debajo, en `caption` `inkSoft`: "La dedicatoria no
   se guarda: se arma en tu teléfono y sale por WhatsApp."

### Imagen
Mismo generador que la 9:16 del versículo del día (`VerseStoryCard`, #161),
sin foto: fondo liso de la plantilla. 1080×1920 (estado) o 1080×1080 (chat),
márgenes `paddingX` y `paddingY` / `squarePaddingY`. De arriba abajo, todo
centrado:
- Título de la plantilla en `overline` (tamaño `season`), color `accent`.
- "Para {nombre}" en serif itálica `ink`, `dedicationTo` → `dedicationToMin`.
- Filete `accent` `dedicationRuleWidth` × `dedicationRule`.
- Dedicatoria entre comillas, serif itálica `dedicationMessage`, `muted`.
- Versículo entre comillas, serif `ink`, entre `verseMax` y
  `dedicationVerseMin` según el largo (`verseStoryLayout.ts`). Nunca se corta.
- Cita · versión en DM Sans medium `reference`, `muted`.
- Abajo: logo + "Bible AI Honduras" en `brand`, `muted`.

### Plantillas (colores de la paleta, nunca un hex suelto)

| Plantilla | Título | Fondo | Texto | Acento |
|---|---|---|---|---|
| Clásica | CON CARIÑO | `paper` | `ink` / `inkMuted` | `accent` |
| Noche | CON CARIÑO | noche `bg` | noche `ink` / `inkMuted` | noche `accent` |
| Temporada (solo si hay, #199) | nombre de la temporada | `season[x].day.bg` | `ink` / `inkMuted` | `season[x].day.accent` |
| Cumpleaños (siempre) | FELIZ CUMPLEAÑOS | `surfaceSunk` | `ink` / `inkMuted` | `sage` |

Con temporada activa, la pantalla arranca en su plantilla; si no, en Clásica.

### Reglas
- Sale por `shareImage` de `src/lib/share.ts` con el código de invitación
  (regla dura #3) y `share_completed` lleva `origin: "dedicated"`.
- La dedicatoria no se guarda ni se manda al servidor.
- Sentir no se comparte ni se dedica: no hay entrada desde ahí.
