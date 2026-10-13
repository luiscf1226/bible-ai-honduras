# Orden de la app + Notas de prédica (#232)

Capturas del QA harness (`QA_HARNESS=1 npx expo start --web`), a 2×, iPhone
390 × 763 salvo donde se indica. El toast rojo de desarrollo ("Convex functions
should not be imported…") se escondió: es un aviso de dev que ya existía.

## Antes

| Captura | Qué muestra |
|---|---|
| `antes-inicio.png` | sin barra de pestañas; Ajustes con el ícono de sol; "Una pausa para hoy" |
| `antes-inicio-peor-dia.png` | fecha personal + franja de temporada + versículo: el inicio ya no entra |
| `antes-leer.png` | ~9 tarjetas antes del índice de libros |
| `antes-mi-espacio.png` | Mi espacio solo desde Ajustes, dos renglones de historial |
| `antes-ajustes.png` | Mi espacio, Exportar y Mis conversaciones también acá |
| `antes-preguntar.png` | Preguntar con ✕ |
| `antes-lector-hoja.png` | hoja del versículo con 12 acciones |

## Después: orden

| Captura | Qué muestra |
|---|---|
| `despues-inicio.png` | barra de pestañas, engranaje, "Leer el devocional", sin la línea de pausa |
| `despues-inicio-peor-dia.png` | fecha personal + temporada (+ recuerdo): **una sola** tarjeta de contexto |
| `despues-inicio-domingo.png` | domingo con fecha personal y temporada: gana "Nueva nota de prédica" |
| `despues-inicio-android-360x728.png` | Android 360 × 800 |
| `despues-inicio-oscuro.png` | noche suave |
| `despues-biblia.png` | búsqueda → separador → recientes → "Planes y recorridos" → libros |
| `despues-planes.png` | `/leer/planes`, las mismas tarjetas que antes estaban en Leer |
| `despues-conversar-*.png` | selector Preguntar · Sentir · Personajes; la pausa ahora vive en Sentir |
| `despues-mi-espacio.png` | pestaña Mi espacio en tres grupos, Tu año siempre a un toque |
| `despues-mis-conversaciones.png` | el único historial, con filtro |
| `despues-ajustes.png` | sin los duplicados de Mi espacio |
| `despues-lector-hoja.png` / `-mas.png` | 4 acciones + "Más", y "Más" desplegado |

## Después: Notas de prédica

| Captura | Qué muestra |
|---|---|
| `notas-lista.png` | lista con búsqueda |
| `notas-editor.png` / `notas-oscuro.png` | editor con 2 pasajes, notas y "¿Qué me llevo?" |
| `notas-nueva.png` | nota nueva con la iglesia y el predicador de la última |
| `notas-agregar-desde-lector.png` | "Nota de prédica" desde "Más" en la hoja del versículo |
| `notas-modo-avion-editor.png` | `?net=off`: nota con 2 pasajes, "Guardada en el teléfono. Se sube cuando haya señal." |
| `notas-modo-avion-lista.png` | la nota escrita sin señal aparece en la lista |
| `notas-candado.png` | `?lock=on&auth=pending`: la lista pide desbloqueo |

## Flujos verificados en el harness (Playwright)

- Deep link en frío a `/voces/moises` → ‹ → `/home`. `/historias/texto/rut` en frío abre.
- Lector → hoja → Preguntar → `/preguntar?book=Salmos&chapter=46&verse=1` → atrás → vuelve al lector.
- Las 5 pestañas navegan a su ruta; Conversar vuelve a la última (Sentir) después de pasar por Inicio.
- Mis conversaciones → tocar una de Preguntar → `/preguntar?conversationId=…`.
- Modo avión: nota con 2 pasajes queda como **una** acción en la cola (`offline/queue.json`); al
  volver la señal la cola se vacía y la nota aparece una sola vez.

## Lo que no se puede ver en el harness

- El aviso de actualización (`useAppUpdate` no corre en web): su prioridad en la tarjeta de
  contexto está cubierta por `homeCards.test.ts`.
- No se probó en iPhone ni Android reales (ver el PR).
