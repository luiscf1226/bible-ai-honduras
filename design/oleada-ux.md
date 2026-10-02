# Oleada UX "inicio en tarjetas" — especificación visual (U0, #190)

> **Origen:** el fundador decidió (2026-10-02) diseñar esta oleada directo en el
> repo, sin la sesión de Claude Design. Este archivo **reemplaza el paso de
> re-exportar el prototipo** para U1–U6 y para lo visual de #199 y #200. Todo lo
> demás de la regla dura #1 sigue vigente: **cero hex, `fontSize`, `borderRadius`
> o padding literal en un componente.** Todo sale de `src/theme/tokens.ts`
> (espejo de `design/tokens.json`).
>
> Vocabulario visual: el mismo del prototipo (tarjetas `surface` con borde
> `border`, radio `xxl`, títulos en EB Garamond, UI en DM Sans light, chips pill,
> acento `accent`). Esta oleada no inventa un estilo nuevo, reordena el que ya hay.

## Tokens nuevos

| Token | Día | Noche | Uso |
|---|---|---|---|
| `color.paper` | `#F7F0E4` | `#25211E` | Fondo de la página del lector (U3) |
| `color.imageScrim` | `rgba(37,34,32,.42)` | `rgba(20,18,16,.55)` | Velo sobre imagen con texto encima (tarjeta del versículo, `/hoy`, 9:16) |
| `type.verseHero` | serif 28 / 38 | | Versículo grande en `/hoy` y tarjeta del inicio |
| `type.dropCap` | serif 58 / 52 | | Capitular del capítulo (U3) |
| `type.verseNumber` | sans medium 10 / 10 | | Número voladito, color `accent` (U3) |
| `type.readerBody` | serif 19 / 31 | | Texto corrido del lector, en el paso "normal" de `readingSettings` |
| `readerPadding` | h 26 · top 18 | | Márgenes de la página (U3) |
| `size.cardAvatar` | 40 | | Avatares en la tarjeta de Personajes (U1) |
| `size.verseCardImage` | 176 | | Alto de la imagen de la tarjeta del versículo (U1) |
| `size.hoyImage` | 236 | | Alto de la imagen en `/hoy` (U2) |
| `size.icon` | sm 16 · md 20 · lg 24 | | Íconos |
| `size.iconStroke` | 1.3 | | Trazo de los íconos |
| `size.ribbon` | 14 × 42 | | Cinta del separador (U3) |
| `size.marginMark` | 5 | | Punto de "guardado" en el margen (U4) |
| `size.actionTile` | 64 | | Celda de la barra de herramientas del versículo (U4) |
| `size.ring` | 1.5 | | Anillo `accent` del personaje del mes (#200) |
| `grid.actionColumns` | 4 | | Columnas de esa barra (U4) |
| `storyImage.*` | 1080×1920, padding 96/150, verso 84→54, ref 36, marca 30, temporada 30 | | Imagen 9:16 (U2 / #161), en píxeles de salida |
| `season.{reforma,gratitud,adviento}` | ver `tokens.json` | | Capa de temporada (#199) |

## Íconos

`src/components/Icon.tsx`, set único con `react-native-svg`. Los trazos del
prototipo (volver, chevrons, cerrar, enviar, check, libro, chat, WhatsApp,
imagen, amanecer, guardado, reloj, candado, refrescar) se copiaron tal cual.
Los nuevos siguen el mismo trazo de 1.3 sobre 24: `menu`, `search`, `plus`,
`note`, `highlight`, `ribbon`, `share`, `copy`, `voice`, `textSize`, `calendar`.
Color siempre desde `useTheme().color`. **No se usan emojis como íconos.**

---

## U1 — Inicio en tarjetas (#193)

Pantalla `surface`, `ScrollView` con `screenPadding.horizontal`, `gap: space.lg`
entre tarjetas. Sin dock abajo.

**Encabezado** (como hoy): logo chico + fecha (`overline`, `inkSoft`) + "Buenos
días / Buenas tardes / Buenas noches" en `title` serif. Ajustes (ícono sol del
prototipo) arriba a la derecha. El aviso de actualización queda arriba de todo.

**Tarjeta base** (`HomeCard`): `surface`, borde 1 `border`, `radius.xxl`,
`cardPadding`. Fila de título: ícono `md` en `accent` + título en `subtitle`
serif `ink` + chevron `sm` `inkFaint` a la derecha. Debajo, una línea de qué
ofrece en `bodySm` `inkMuted`. Contenido propio. Toda la tarjeta es tocable
(`opacity.pressed`).

1. **Versículo del día.** Sin fila de título. Imagen del devocional arriba
   (`size.verseCardImage`, radio superior `xxl`) con `imageScrim` y, sobre la
   imagen abajo a la izquierda, `VERSÍCULO DEL DÍA` en `overline` color
   `surface`. Debajo, en el cuerpo de la tarjeta: versículo en `verseHero`
   (máx. 5 líneas, `numberOfLines`), cita · versión en `caption` medium
   `inkMuted`, y un pie con "Una pausa para hoy →" en `bodySm` `accentDeep`.
   Toca → `/hoy`.
2. **Leer la Biblia** (ícono `book`). Línea: "Génesis a Apocalipsis, con tu
   separador y tus notas". Línea de estado tocable en un recuadro `surfaceSunk`
   radio `lg`: cinta `ribbon` `accent` + "Tu separador · Salmos 46:1" (o "Seguí
   leyendo · Juan 3", o "Empezá por Génesis 1"). Fila de 4 chips pill con ícono
   `sm`: **Subrayados** (`highlight`) · **Guardados** (`bookmark`) · **Notas**
   (`note`) · **Planes** (`calendar`). Chip = borde `borderStrong`, `chip`
   type, `inkSoft`.
3. **¿Cómo estás hoy?** (ícono `sunrise`). Compacta: 3 chips de sentimiento +
   chip "Escribilo con tus palabras…" (borde punteado `borderStrong`). Nada más.
4. **Preguntar sobre la Biblia** (ícono `chat`). Línea: "Respuestas con cita,
   siempre desde el texto". Pregunta de ejemplo del día en un recuadro
   `surfaceSunk` en serif `versePicker` con comillas, y debajo la cuota
   ("3 preguntas gratis hoy" / "Pro · sin límite") en `caption` `inkSoft`.
5. **Personajes de la Biblia** (ícono `voice`). Fila de 4 avatares
   (`size.cardAvatar`, mismo `LinearGradient` + inicial de `voces.tsx`) con el
   nombre debajo en `caption`. Línea: "Conversá con Moisés, Ester, David…".
   Si hay **personaje del mes** (#200), el primer avatar lleva un anillo
   `accent` de 1.5 y la etiqueta `DEL MES` en `overline` `accent` encima.
6. **Historias** (ícono `image`). Miniatura de una historia (alto
   `size.verseCardImage` × 0.5, radio `lg`) + título en `subtitle` + "Historias
   bíblicas en texto e imágenes".

Noche: todas las tarjetas usan la paleta `night`; la imagen conserva el scrim.

## U2 — Versículo del día `/hoy` (#194)

`ScrollView` sobre `surface`.
- **Hero:** imagen a todo el ancho (`size.hoyImage`) con `imageScrim`. Sobre
  ella: botón volver (círculo `backButton`, fondo `surface` al 90 %) arriba a la
  izquierda y la fecha en `overline` `surface` abajo a la izquierda.
- **Versículo:** `verseHero` serif `ink`, con márgenes `screenPadding`, y debajo
  `<CitationLink variant="block">`.
- **Devocional** en secciones, cada una con su `overline` `accent` arriba:
  `ORACIÓN INICIAL` (serif itálica `subtitle`, `inkMuted`) → `INTRODUCCIÓN`
  (`body` `inkMuted`) → `UNA PAUSA PARA HOY` (reflexión, `body`) →
  `ORACIÓN FINAL` (tarjeta `surfaceSunk` radio `xl`, serif itálica). Las
  secciones que no vengan del servidor no se muestran.
- **Acciones:** fila principal de dos botones `AppButton`: **Compartir imagen**
  (primario, ícono `whatsapp`) y **Compartir texto** (secundario, ícono
  `share`). Debajo, lista de 3 filas con ícono `md` `accent`, etiqueta `label`
  y chevron: **Guardar** (`bookmark`, relleno si ya está, etiqueta "Guardado"),
  **Leer el capítulo completo** (`book`), **Preguntar sobre este versículo**
  (`chat`). Separadores `border`.

### Imagen 9:16 (#161)
1080×1920 (`storyImage`). Fondo: la imagen del devocional cubriendo todo +
`imageScrim` noche. Centro vertical: versículo en EB Garamond color `surface`
(tamaño entre `verseMax` y `verseMin` según largo, lo calcula
`verseStoryLayout.ts`), cita · versión en DM Sans medium `reference`
`surface` al 85 %. Abajo centrado: logo chico + "Bible AI Honduras" en
`brand`. Márgenes `paddingX`/`paddingY`.

## U3 — Lector "Biblia de papel" (#195)

- **Página** en `color.paper`, `readerPadding`. Encabezado fijo: volver a la
  izquierda, al centro `SALMOS · 46` en `overline` `inkSoft` + versión debajo
  en `caption`, a la derecha botón `textSize` ("Aa") que abre `BottomPanel` con
  tamaño y espaciado (lógica actual de `readingSettings.ts`).
- **Capitular:** el número del capítulo en `dropCap` `accent`, a la izquierda
  del primer renglón (flotado con `position: absolute` y sangría de las
  primeras dos líneas).
- **Texto corrido:** un solo `<Text>` por bloque de ~20 versículos (rendimiento),
  versículos anidados. Número voladito `verseNumber` `accent` con un espacio
  fino después. **Prosa continua**, sin sangrías por versículo. Tamaño base
  `readerBody`, escalado por `readingSettings`.
- **Cinta del separador:** `ribbon` (`size.ribbon`) en `accent`, colgando desde
  el borde superior de la página en el margen derecho, a la altura del versículo
  marcado; testID `reading-separator-mark`.
- **Pasar página:** deslizar horizontal (anterior/siguiente). Al final del
  capítulo, "‹ Génesis 1 · Génesis 3 ›" como botones pill (respaldo accesible).
- *Notas de implementación (#195/#196):* React Native no tiene
  `baselineOffset` para un `<Text>` anidado, así que el número voladito usa las
  cifras superíndice de EB Garamond (¹²³…) en `accent`, al tamaño del cuerpo;
  a `readerBody` 19 quedan a ~11, el `verseNumber` de la tabla. La capitular
  baja hasta que su pie coincide con el del último renglón que abraza. La cinta
  es `size.ribbon` con punta en V, centrada en el margen derecho a la altura del
  renglón del versículo. El deslizar usa `PanResponder` + `Animated` (sin
  dependencias nuevas).

### Índice `/leer`
Arriba: tarjetas de separador / plan / "Seguí leyendo" (como hoy), y un campo
de búsqueda compacto (ícono `search`, pill `surfaceSunk`). Luego dos pestañas
pill **Antiguo Testamento · Nuevo Testamento**. Cada sección con su `overline`
`accent` (LEY, HISTORIA, POESÍA, PROFETAS MAYORES, PROFETAS MENORES /
EVANGELIOS Y HECHOS, CARTAS DE PABLO, CARTAS GENERALES, APOCALIPSIS) y los
libros como lista en serif `versePicker` con separadores `border`, en dos
columnas. Tocar un libro → `ChapterGrid`.

## U4 — Herramientas del versículo (#196)

- **Pista de primera vez:** franja `surfaceSunk` radio `lg` arriba de la
  página, ícono `highlight` `accent` + "Tocá un versículo para subrayar,
  guardar, anotar o poner tu separador" en `bodySm` + ✕ (`close` `sm`).
- **Versículo tocado:** fondo `highlightSand` mientras la hoja está abierta.
- **Hoja (`BottomPanel`):** cita en `subtitle` serif + 2 líneas del texto en
  `versePicker` `inkMuted` → fila de 4 círculos de color de subrayado (24, con
  check si está activo, y un quinto "sin color") → cuadrícula de
  `grid.actionColumns` columnas con celdas de `size.actionTile`: ícono `lg`
  `ink` + etiqueta `caption` `inkMuted`: **Guardar** (`bookmark`) · **Nota**
  (`note`) · **Separador** (`ribbon`) · **Compartir** (`share`) · **Preguntar**
  (`chat`) · **Hablar con {personaje}** (`voice`, solo si aplica) · **Copiar**
  (`copy`). Activo (guardado / es el separador) = ícono `accent` relleno.
- **Marcas en el margen** (margen izquierdo, fuera del texto corrido): punto
  `size.marginMark` `accent` para guardado; ícono `note` `sm` `inkSoft` para
  nota. A la altura del renglón donde empieza el versículo.
- *Notas de implementación:* la hoja se cierra con ✕ (`close`) arriba a la
  derecha, en lugar del "Cancelar" de antes. El quinto círculo "sin color" es un
  aro `borderStrong` con `close` `sm`, deshabilitado si no hay subrayado. Las
  acciones salen de `src/features/reading/verseActions.ts` (registro: una
  entrada por acción, para #202, #187, #158 y #201).

## U5 — Sentir tipo chat (#197)

- **Header:** ☰ (`menu`) izquierda → `SideDrawer` con "Nuevo devocional" (fila
  con `plus` `accent`) arriba y "Los de antes" debajo; título "Sentir" en
  `subtitle` serif al centro; volver al inicio a la derecha (`close`).
- **Vacío:** centrado en el espacio libre: ícono `sunrise` `lg` `accent`,
  "¿Qué llevás encima hoy?" en `title` serif, y la línea de privacidad en
  `caption` `inkSoft`.
- **Composer fijo** (patrón de `preguntar/chat.tsx`): cuota en `caption`
  `inkSoft` arriba, fila horizontal de chips de `FEELINGS` (seleccionado =
  fondo `ink`, texto `surface`), campo pill "Contame cómo te sentís…" con botón
  enviar (`send`) `ink`.
- **Hilo:** mensaje del usuario como burbuja `ink` a la derecha (chips como
  texto "Ansiedad · Cansancio" + su texto). Devocional como tarjeta a todo el
  ancho (`surface`, borde, `radius.xl`): `overline` `accent` con el título,
  versículo en serif itálica con filete izquierdo `borderStrong`,
  `<CitationLink variant="block">`, reflexión, tarjeta de oración
  `surfaceSunk`, y fila de acciones con íconos `sm`: Compartir · Leer el
  capítulo · Recorrido. Debajo, chips **Otro devocional** y **Tengo una
  pregunta sobre esto**.
- **Límite:** `LimitReached variant="inline"` en el lugar del composer.

## U6 — Preguntar (#198)

- **Header:** ☰ (`menu`) izquierda → `SideDrawer` con "Nueva pregunta" y la
  lista de `qa.conversations` (título en `label`, última pregunta en `caption`
  `inkSoft`, una línea). Título: el del tema o "Preguntar"; cuota debajo.
- **Vacío:** "¿Qué querés entender hoy?" en `title` serif + tres grupos con
  `overline` `accent` (PARA ENTENDER · PARA MI VIDA · SOBRE PERSONAJES), cada
  uno con 2 preguntas como filas tocables en `versePicker` serif con chevron.
  Con pasaje: un solo grupo "SOBRE {PASAJE}".
- **Chip de pasaje** encima del campo: pill borde `borderStrong`, ícono `book`
  `sm` + "Elegir pasaje (opcional)" o "Juan 3" + `close` `sm`. Abre una hoja
  (`BottomPanel`) con `PassageSearch` + `ChapterGrid`.
- **Burbujas** como hoy, con `<CitationLink>`.
- **Límite:** el hilo se ve; el composer se reemplaza por `LimitReached
  variant="inline"`: tarjeta `surfaceSunk` radio `xl`, texto `bodySm` y botón
  `AppButton` "Ver Pro".

## Temporadas (#199) y personaje del mes (#200)

- **Capa de temporada:** `ThemeProvider` mezcla `season[palette][day|night]`
  encima de la paleta activa. Solo pisa `accent`, `accentDeep`, `bg` y
  `surfaceSunk`; el resto queda igual (contraste del texto garantizado).
- **Inicio con temporada:** arriba de la tarjeta del versículo, franja de
  temporada: `overline` `accent` con el nombre ("MES DE LA REFORMA") + una
  línea `bodySm` `inkMuted`. Sin imagen nueva en v1.
- **9:16 con temporada:** el nombre de la temporada en `overline` arriba al
  centro, color `surface` al 85 %.
- **Personaje del mes:** en Voces, tarjeta arriba de la lista: avatar
  `size.avatar` con anillo `accent`, `DEL MES` `overline`, nombre en
  `subtitle`, una línea de quién fue, y fila de atajos con íconos `sm`
  (Su historia · Capítulos · Recorrido · Conversar). En el inicio: anillo en
  la tarjeta de Personajes (U1).
