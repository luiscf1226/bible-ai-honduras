# Oleada: lectura, home más clara y listos para tienda

Pedido del 30 de septiembre de 2026. Este documento separa **lo que ya entra en el PR**
de **lo que queda como tickets**, con las ideas nuevas propuestas.

Capturas del PR: [`docs/qa/2026-09-30-lectura-home/`](../qa/2026-09-30-lectura-home/).

---

## 1. Lo que entra en este PR

| Pedido | Qué se hizo |
|---|---|
| Plan para leer la Biblia completa en un año, para quien nunca la leyó | Plan nuevo **"La Biblia en un año · para empezar"** (`anual-para-empezar`): cada día un poco de AT, NT y Salmos/Proverbios. El día 1 ya trae Génesis 1, Mateo 1 y Salmos 1. Mismo motor, tablas y racha que el canónico, que **no cambia**. |
| Separador en el lector, como en un libro físico | **Separador**: uno solo por persona, se pone o se quita desde la hoja de acciones del versículo ("Poner el separador aquí"). El versículo marcado muestra la cinta; desde otro capítulo aparece "Ir a tu separador"; en Leer queda primero la tarjeta "TU SEPARADOR". No se mueve solo (eso sigue siendo "Seguí leyendo"). Tabla nueva `readingSeparators`, incluida en el borrado de cuenta. |
| Escribir tu propio sentimiento | Chip **"Otro · lo escribo yo"** al principio de la lista, que lleva al campo libre; el campo ahora tiene su etiqueta ("O ESCRÍBELO CON TUS PALABRAS") y un placeholder que lo explica. |
| El historial de Sentir no arriba, a la izquierda | "Los de antes" pasa a un **cajón lateral desde la izquierda** (`SideDrawer`, reutilizable), abierto con el botón "Los de antes · N" de arriba. |
| "¿Cómo estás hoy?" más claro | La tarjeta del inicio dice qué recibís (versículo, reflexión y oración), trae atajos de sentimiento (Ansiedad, Cansancio, Gratitud, Ver todos) y un campo "O escribilo con tus palabras…" que abre Sentir con el teclado listo. |
| Preguntar / Voces / Historias más claros y la home menos cargada | El grid de 4 tarjetas pasa a una **barra fija abajo** (Leer · Preguntar · Voces · Historias), cada una con una línea de qué hace. |
| Políticas listas para publicar | **Términos de uso** nuevos (`public/terminos/` + `docs/store/terms-of-use.md`), enlazados desde el **paywall** (App Store 3.1.2 lo exige para suscripciones), desde Ajustes y desde las otras páginas legales. La política de privacidad ahora declara los datos de lectura (progreso, guardados, separador, planes). |
| Versiones de la Biblia | Ver §3 — no se puede resolver en código. |

### ⚠️ Regla dura #1 — pendiente de Claude Design

Ninguno de estos layouts existe en el prototipo: la barra fija del inicio, los atajos de
"¿Cómo estás hoy?", el cajón lateral, el chip "Otro", la cinta del separador y la tarjeta
del plan para empezar. Están armados **solo con tokens y patrones que sí están en el
prototipo** (chips, composer de Voces, `BottomPanel`, punto de "Los de antes"), sin un solo
hex, tamaño o radio nuevo. Antes de fusionar hay que ratificarlos en Claude Design y
re-exportar `design/` (ticket T1).

---

## 2. Tickets propuestos

Orden sugerido. Todos en español, como el resto de los issues.

### T1 — Ratificar en Claude Design los layouts de esta oleada · *bloquea el merge*
Diseñar en Claude Design: barra fija del inicio, tarjeta "¿Cómo estás hoy?" con atajos,
cajón lateral de historial, chip "Otro", cinta del separador, tarjeta "Para empezar".
Re-exportar `design/` y ajustar el código si el diseño cambia.
**Criterio:** cada pantalla del PR tiene su par en el prototipo.

### T2 — Versión de la Biblia: decidir licencia o corpus de dominio público
Hoy solo RV1909 tiene corpus (`convex/bibleVersions.ts`). RVR1960 (Sociedades Bíblicas
Unidas) y NVI (Biblica) necesitan licencia comercial. Opciones:
1. **Pedir licencia** de RVR1960 — la que más usa la iglesia evangélica hondureña.
2. Agregar otra de **dominio público** (p. ej. Reina-Valera 1865) mientras tanto.
3. Seguir solo con RV1909 y explicarlo en Ajustes.
**Decisión de producto/legal, no de código.** Cuando haya corpus, alcanza con ingerirlo
(`npm run rag:ingest`) y agregarlo a `AVAILABLE_BIBLE_VERSIONS`.

### T3 — Revisión legal de Términos y Privacidad antes del lanzamiento
Los textos quedaron listos para la ficha, pero son un borrador técnico.
**Criterio:** abogado revisa; URLs cargadas en App Store Connect (Términos/EULA,
Privacidad, Soporte) y en Play Console (Privacidad, Eliminación de datos).

### T4 — El recordatorio diario menciona la lectura del plan
Ya está anotado como `TODO(#114)` en `src/lib/dailyReminder.ts`. Con dos planes anuales
hay que decidir cuál se menciona (el último abierto).

### T5 — El lector abre en el versículo del separador
Hoy abre el capítulo con la hoja de acciones del versículo; falta hacer scroll hasta él
en capítulos largos (Salmos 119).

### T6 — Revisión pastoral del plan "para empezar"
Igual que los recorridos (#115): el reparto es aritmético; un pastor confirma que el orden
(AT + NT + Salmos/Proverbios) es el que se quiere recomendar.

### T7 — Arreglos del harness de QA
En este PR se arreglaron tres (`useConvex` estable, `usePaginatedQuery`, fixtures de
Lectura y RV1909). Queda: `public/index.html` choca con la plantilla de Expo web; mover
la portada legal a `public/legal/` o configurar el harness para ignorarla.

---

## 3. Ideas nuevas (además de las pedidas)

Cada una con su ticket propuesto. Ninguna rompe las reglas duras: todo contenido bíblico
sigue anclado al RAG (#4) y los límites pasan por el servicio de cuotas existente (#3).

### I1 — Escuchar el capítulo (audio de la Biblia)
Botón "Escuchar" en el lector con texto a voz del RV1909. Mucha gente escucha en el bus o
mientras trabaja, y ayuda a quien lee con dificultad. Gratis (leer es gratis).
**Ticket:** TTS del sistema (`expo-speech`) primero; voz grabada después si funciona.

### I2 — Versículos para memorizar
Desde la hoja del versículo: "Memorizar". Tarjetas con repaso espaciado (hoy, en 3 días,
en una semana) y un ejercicio de completar palabras. Encaja con los guardados que ya
existen.

### I3 — Diario de oración
Peticiones privadas con fecha, que se pueden marcar como **respondidas**. Al cerrar un
devocional de Sentir: "Guardar como petición". Mismo criterio de privacidad que Sentir
(nada se comparte ni se publica) y entra en el borrado de cuenta.

### I4 — Biblia sin conexión
Descargar el RV1909 en el teléfono para leer sin datos. En Honduras los datos móviles son
caros y la señal se cae fuera de las ciudades. Solo el lector y los planes funcionan
offline; la IA sigue necesitando conexión.

### I5 — Imagen del versículo para el estado de WhatsApp
Además del texto que ya se comparte (#36), generar una imagen vertical con el versículo del
día y el fondo del devocional, lista para el estado. Usa el componente de compartir
existente — no una variante nueva.

### I6 (para v1.1) — Plan en familia o en grupo
Leer el mismo plan con la familia o la célula de la iglesia y ver quién va al día. Depende
de la comunidad (PRD §9c), por eso queda para después.
