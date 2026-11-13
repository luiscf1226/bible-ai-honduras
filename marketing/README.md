# Videos de 3C (Remotion + la app real)

Videos verticales para TikTok y Reels de Instagram. Las pantallas **no se
dibujan a mano**: un script abre la app real en el navegador (el harness de
QA, `qa-harness/`), hace la pregunta, espera la respuesta y lo graba. Remotion
solo agrega el gancho del principio, el versículo y el cierre. Si la app
cambia, los videos cambian con ella.

Es un proyecto aparte, con su propio `package.json`. No entra al build de Expo.

## Voz y música

Las voces son de ElevenLabs (español latino, biblioteca de voces), elegidas
de oído en `scripts/voz.mjs`:

| Qué se oye | Voz |
|---|---|
| Gancho, respuesta de Preguntar, versículo y cierre | Antonio (una sola voz por video) |
| Historias del feed | Antonio |
| Moisés | El Faraón, «abuelo cálido» |
| David · Pablo · Elías | Juan Carlos · Mauricio · Alberto Rodríguez |
| Ester · Rut | Norah · Carolina G |
| Otro personaje sin voz elegida | su voz de los reels de la app (`feedReelsCore.reelVoice`, OpenAI) |

Jesús, Dios y el Espíritu Santo nunca tienen voz en primera persona (regla
dura #2). La grabación espera lo que dura cada voz, así pantalla y voz
terminan juntas. Cada audio se guarda en `~/Work/personal/3c-videos/.voces/`
y no se vuelve a pagar si el texto no cambia. Las keys van en
`~/.config/3c-videos/elevenlabs.env` (`ELEVENLABS_API_KEY=…`) y
`openai.env` (`OPENAI_API_KEY=…`), con permisos 600; sin ellas, los videos
salen mudos y el `LEEME.md` lo avisa.

La música **no** va en el archivo: se elige un sonido en tendencia en TikTok
o Instagram al publicar, a volumen bajo debajo de la voz.

## Qué sale cada semana

Siete videos, uno por día:

| Tipo | Qué se graba | ¿Hay que pegar algo? |
|---|---|---|
| `versiculo` | el feed abierto en ese versículo | no |
| `historia` | un reel de historia del feed, parte por parte, narrado | no |
| `monologo` | un reel de personaje del feed (1ra persona, curado en `docs/content/personajes-feed.json`) | no |
| `pregunta` | Preguntar: la pregunta y la respuesta que da la app | no |
| `personaje` | Voces: la conversación con el personaje | no |
| `instalar` | la página de descarga como la ve un Android, con los pasos | no |
| `presentacion` | inicio, feed, Preguntar y Voces | no |

Las semanas 1 a 4 son las del plan (`plan/semanas.json`). Después, cada
semana se arma sola con versículos, historias y monólogos que todavía no
salieron; para elegir otra cosa, agregá la semana al plan.

## Cómo funciona cada semana

1. **Domingo 7:00**: `3c-videos.timer` le hace a la app real las preguntas de
   Preguntar y Voces de la semana que viene (regla dura #4: el mismo RAG del
   teléfono, nada escrito a mano) y las anota en
   `~/Work/personal/3c-videos/respuestas/semana-NN.md`.
2. Hace los videos en `~/Work/personal/3c-videos/semana-NN/`, con un
   `LEEME.md` que trae la caption corta de cada publicación, y copia todo a
   `~/Downloads/3c-videos-semana-NN/`.
3. Te manda la semana por correo en un solo hilo: el primer mensaje con
   todas las captions y cada video como respuesta en ese hilo, porque Gmail no
   acepta más de 25 MB por mensaje (ver `scripts/correo.mjs`; la cuenta va en
   `~/.config/3c-videos/correo.env`).
4. Si cambiás una pregunta en el archivo de respuestas y borrás su respuesta,
   `3c-videos.path` la vuelve a preguntar y rehace la semana.

Preguntar usa `rag/answer:ask` (lo mismo que `qa.ask`, sin guardar la
conversación) y Voces usa `voices:sendMessage` como la cuenta de prueba de App
Review, con tu sesión del CLI de Convex.

En el navegador, react-native-web dice que siempre hay lector de pantalla, y
con lector los reels no avanzan solos. Mientras se graba un video, el harness
le dice a la app que no hay lector, así los reels avanzan como en el teléfono.

## Comandos

```bash
cd marketing
npm install
npm run semana                  # la semana que viene y las que tengan respuestas nuevas
npm run semana -- 2             # una semana concreta
npm run semana -- 2 --forzar    # aunque nada haya cambiado
npm run semana -- 2 --reenviar  # vuelve a mandar los correos de esa semana
npm run semana -- 5 --ver       # qué sale esa semana, sin grabar
npm run instalar-automatico     # instala el timer del domingo y el vigilante de respuestas
npm run studio                  # ver y ajustar las plantillas en el navegador
```

`semana` necesita las dependencias de la app (`npm ci` en la raíz) porque
levanta el harness con `QA_HARNESS=1 npx expo start --web`. Si ya está
corriendo en el puerto 8081, lo usa.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Plan de las semanas (ganchos, preguntas, textos) | `plan/semanas.json` |
| Grabar la app real | `capture/capture.mjs` |
| Armar una semana de punta a punta | `scripts/semana.mjs` |
| Plantilla del video (gancho, grabación, versículo, cierre) | `src/Video.tsx`, `src/components/` |
| Contenido inyectado en el harness | `window.__QA_VIDEO__` → `qa-harness/mocks/scenario.js` |
| Timer y vigilante de systemd | `systemd/`, `scripts/instalar-automatico.sh` |

## Reglas

- Colores, fuentes, radios y espacios de las partes que agrega Remotion salen
  de `design/tokens.json` (regla dura #1). Las fuentes son los archivos de
  `@expo-google-fonts` que usa la app.
- Solo personajes humanos hablan en primera persona (regla dura #2).
- La app que se graba es el harness: datos de prueba, nunca datos de usuarios
  reales.
