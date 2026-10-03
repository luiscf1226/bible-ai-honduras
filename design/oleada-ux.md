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
| `size.tileAvatar` | 30 | | Avatares encimados en el mosaico de Personajes (U1b) |
| `size.verseCardImage` | 176 | | Alto de la imagen de la tarjeta del versículo (U1) |
| `size.hoyImage` | 236 | | Alto de la imagen en `/hoy` (U2) |
| `size.icon` | sm 16 · md 20 · lg 24 | | Íconos |
| `size.iconStroke` | 1.3 | | Trazo de los íconos |
| `size.ribbon` | 16 ancho · 42 largo mínimo · fade 18 · sombra 1.5 · tejido 2.5 | | Cinta de satén del separador (U3, §Separador físico) |
| `size.seasonGarland` | 32 | | Alto de la guirnalda de temporada (lienzo 320 × 32) |
| `opacity.ribbon*` | brillo 0.38 · sombra 0.16 · tejido 0.45 | | Satén de la cinta del separador |
| `size.marginMark` | 5 | | Punto de "guardado" en el margen (U4) |
| `size.actionTile` | 64 | | Celda de la barra de herramientas del versículo (U4) |
| `size.ring` | 1.5 | | Anillo `accent` del personaje del mes (#200) |
| `grid.actionColumns` | 4 | | Columnas de esa barra (U4) |
| `storyImage.*` | 1080×1920, padding 96/150, verso 84→54, ref 36, marca 30, temporada 30 | | Imagen 9:16 (U2 / #161), en píxeles de salida |
| `season.{reforma,gratitud,adviento,anio-nuevo}` | ver `tokens.json` | | Capa de temporada (#199) |
| `seasonDecor.*` | warm · gold · leaf · deep, día y noche | | Tonos de la guirnalda de temporada |

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

## U1b — Inicio compacto: todo en una pantalla

Reemplaza el largo de U1: el inicio entra entero en una pantalla, sin scroll,
en un iPhone 12–15 (390 × 763 útiles) y en un Android de 360 × 728, también con
la franja de temporada. El `ScrollView` queda solo de respaldo (iPhone SE, letra
grande, o los días con Tus fechas / "Hace un año guardaste…").

Orden: encabezado → (temporada) → **Versículo del día** → ¿Cómo estás hoy? →
Un minuto de pausa → cuadrícula 2×2 **Leer · Preguntar · Personajes ·
Historias**. Separación `space.sm` entre renglones y entre mosaicos; arriba,
`space.sm` en vez del `space.xxl` de `AppScreen`.

1. **Versículo del día.** La imagen ocupa toda la tarjeta (`imageScrim`
   encima) y es la única que se estira: se queda con el alto que sobra
   (`flex: 1`, mínimo `size.verseCardImage`). Abajo, sobre la imagen y en
   `surface`: `VERSÍCULO DEL DÍA` `overline`, el versículo en serif `verse`
   (máx. 4 líneas) y una fila con cita · versión (`caption` medium, al
   `opacity.imageMuted`) y "Una pausa para hoy ›" (`bodySm`). Cargando o con
   error, fondo `surfaceSunk` y texto `ink`/`inkMuted`.
2. **¿Cómo estás hoy?** `HomeCard` sin línea; los 3 chips se reparten el ancho
   en una sola fila y "Escribilo con tus palabras" pasa a ser un chip punteado
   de solo lápiz (`note`), con su `accessibilityLabel`.
3. **Un minuto de pausa**, igual que antes.
4. **Mosaicos** (`HomeTile`): misma piel que `HomeCard` (`surface`, borde,
   `radius.xxl`, `cardPadding.horizontal`, `space.md` vertical). Arriba ícono
   `md` `accent` y chevron `sm` `inkFaint`; título serif `subtitle` en una
   línea; una sola pieza viva en `caption` light `inkMuted` (máx. 2 líneas):
   - **Leer la Biblia**: cinta `ribbon` + "Tu separador · Salmos 46:1" (tocable,
     abre el pasaje). Subrayados, Guardados, Notas y Planes viven en Leer.
   - **Preguntar**: la pregunta de ejemplo del día (tocable, abre el chat con la
     pregunta escrita). La cuota se ve adentro de Preguntar.
   - **Personajes**: 4 avatares `size.tileAvatar` encimados `space.sm`. Con
     personaje del mes (#200), anillo `accent` en el primero y `DEL MES`
     `overline` `accent` arriba a la derecha.
   - **Historias**: "Hoy: <título de la historia del día>".

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
- **Cinta del separador:** cinta de satén en el margen derecho que cae desde el
  borde de arriba de la página hasta el versículo marcado (ver §Separador
  físico); testID `reading-separator-mark`.
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
  línea `bodySm` `inkMuted`. La guirnalda cuelga de la foto del versículo (ver
  §Decoración de temporada).
- **9:16 con temporada:** el nombre de la temporada en `overline` arriba al
  centro, color `surface` al 85 %.
- **Personaje del mes:** en Voces, tarjeta arriba de la lista: avatar
  `size.avatar` con anillo `accent`, `DEL MES` `overline`, nombre en
  `subtitle`, una línea de quién fue, y fila de atajos con íconos `sm`
  (Su historia · Capítulos · Recorrido · Conversar). En el inicio: anillo en
  la tarjeta de Personajes (U1).


## Decoración de temporada

Cada mes con paleta trae una **guirnalda**: ilustración plana de
`size.seasonGarland` de alto (lienzo 320 × 32, ancho completo) que **cuelga
del borde de arriba de la foto del versículo del día**, como un adorno en un
cuadro. No ocupa alto: el inicio compacto (U1b) sigue entrando en una
pantalla. Sobre la foto usa siempre los tonos de noche (los claros). Decorativa: no se lee, no se toca. Adornos en
`src/features/seasons/seasonDecor.ts`, dibujo en `SeasonGarland.tsx`, tonos en
`tokens.seasonDecor[paleta][day|night]`.

| Mes | Paleta | Guirnalda |
|---|---|---|
| Octubre | `reforma` (otoño) | Cordel con hojas que caen (óxido, oro), calabazas y flores |
| Noviembre | `gratitud` (cosecha) | Trigo, calabazas, flores y hojas |
| Diciembre | `adviento` (Navidad) | Ramas de pino, esferas, acebo, flor de pascua al centro y la estrella de Belén |
| Enero | `anio-nuevo` ("Tu versículo del año") | Sin cordel: destellos de madrugada y dos ramas de olivo |

- **Línea de producto:** nada de Halloween. Calabazas de cosecha, sin caras; la
  estrella de Navidad es la de Belén. Diciembre deja el morado litúrgico y pasa
  a rojo de flor de pascua (`accent` `#9A4A42` de día, `#C7766B` de noche).
- **Tonos:** `warm` calabaza / flor de pascua / esferas, `gold` flores, trigo y
  estrellas, `leaf` hojas, pino y olivo, `deep` tallos y cordel.
- **Sin paleta conocida**, sin guirnalda: la foto del versículo queda como siempre.

## Separador físico

La cinta del separador es la de una Biblia de papel, no un ícono:

- **Largo:** cae desde el borde de arriba de la página (`top: 0`) y la punta en
  V termina al pie del renglón del versículo marcado. Largo mínimo
  `size.ribbon.height`.
- **Satén:** degradado horizontal `accentDeep` → `accent` → `accentDeep`, con
  un brillo de `surface` al `opacity.ribbonSheen` corrido a la izquierda del
  centro.
- **Tejido:** dos puntadas finas de `accentDeep` al `opacity.ribbonWeave`, a
  `size.ribbon.weaveInset` de cada borde.
- **Sombra:** la misma cinta en `ink` al `opacity.ribbonShadow`, corrida
  `size.ribbon.shadow` abajo a la derecha: se despega del papel.
- **Entrada:** los primeros `size.ribbon.fade` px se funden con `paper`, como si
  entrara por el canto del libro.
- **Color:** sigue `accent`, así que toma el tono de la temporada (rojo en
  Navidad, azul de madrugada en enero).

## Un minuto de pausa `/pausa` (#203)

Pantalla completa sobre `bg` (que ya trae la temporada, #199). Nada más que el
versículo, el silencio y una salida.

- **Encabezado:** ‹ de `ScreenHeader` ("Salir de la pausa": se puede salir en
  cualquier momento) y al centro `UN MINUTO DE PAUSA` en `overline` `inkSoft`.
- **Versículo:** centrado en el espacio libre, `verseHero` serif `ink`, con
  comillas; debajo la cita · versión en `caption` medium `inkMuted`. Es el
  versículo del día o el del devocional de Sentir del que se viene, siempre con
  su texto del corpus (`rag.verses.citedForUser`), nunca generado.
- **Paso del tiempo:** una sola línea de `size.pauseLine` al pie, pista
  `border` y relleno `accent`, que avanza lineal durante el minuto. Sin números,
  sin cuenta regresiva.
- **Cierre:** "Amén" en `title` serif `accentDeep`, y dos salidas: **Leer el
  capítulo** (`AppButton` primario, ícono `book`) y **Volver** (`quiet`). El
  cierre ocupa su lugar invisible durante el minuto para que el versículo no
  salte.
- **Ritmo** (`motion`, ms): el versículo aparece tras `verseDelay` 600 en un
  fundido de `verseFadeIn` 2400; el minuto es `pause` 60000; el cierre entra en
  `closeFadeIn` 1200. Curvas suaves (`ease-out`), sin rebote. Con "reducir
  movimiento" nada se anima: el versículo y el cierre aparecen de una y la línea
  avanza a saltos de un segundo.
- **No hay:** racha, contador de pausas, confetti ni sonido. La pantalla no se
  apaga durante el minuto (`expo-keep-awake`) y vuelve a lo normal al terminar o
  al salir. Al terminar solo se manda `track("pause_completed")`, sin contenido.

| Token | Valor | Uso |
|---|---|---|
| `size.pauseLine` | 2 | Alto de la línea del tiempo |
| `motion.pause` | 60000 | Duración del minuto |
| `motion.verseDelay` | 600 | Respiro antes de que aparezca el versículo |
| `motion.verseFadeIn` | 2400 | Fundido del versículo |
| `motion.closeFadeIn` | 1200 | Fundido del "Amén" y las salidas |
