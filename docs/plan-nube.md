# Plan: los videos semanales en la nube, sin la laptop

Hoy el lote del domingo (`marketing/`, `npm run semana`) corre en la laptop
con el timer de systemd. El lote hace cuatro cosas:

1. Le pide las respuestas de Preguntar y Voces a Convex con `npx convex run`.
2. Levanta la app web (QA harness) y la graba con Chrome.
3. Pone las voces de ElevenLabs y renderiza los 7 videos con Remotion y ffmpeg.
4. Manda la semana por Gmail (SMTP, puerto 465) en un solo hilo.

Tarda unos 25–35 minutos por semana y genera unos 60 MB de video.

Hay un gasto que es igual en todas las opciones: ElevenLabs. Ya se paga hoy,
y las voces repetidas no se vuelven a pagar porque quedan en caché. Verificá
el plan en [elevenlabs.io/pricing](https://elevenlabs.io/pricing).

## Opción A: GitHub Actions con cron (recomendada)

**Hecho:** `.github/workflows/videos-semanales.yml` con `schedule: cron "0 13 * * 0"`,
o sea domingo 7:00 en Honduras. A mano (Run workflow) corre en dry-run por
defecto. GitHub puede atrasar unos minutos los cron que caen en punto.

- **Costo: $0/mes.** El repo es público, y en un repo público los runners
  estándar de GitHub son gratis
  ([docs de GitHub](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions)).
  Si el repo se vuelve privado, 4 corridas de ~35 min son ~140 min al mes, dentro
  de los 2.000 min incluidos en el plan Free.
- **Pasos:**
  1. Agregar el workflow:
     - `ubuntu-latest`, `npm ci` en la raíz y en `marketing/`, `apt-get install ffmpeg`.
     - `npm run semana`.
     - Guardar `~/Work/personal/3c-videos/.voces` con `actions/cache`, para no
       volver a pagar las voces.
  2. Cambiar `scripts/respuestas.mjs` para que use `CONVEX_DEPLOY_KEY` en vez
     de la sesión del CLI: sin `--deployment`, porque la key ya dice cuál es.
  3. Que `scripts/voz.mjs` y `scripts/correo.mjs` también lean las keys de
     variables de entorno. Hoy solo leen los archivos de `~/.config/3c-videos/`.
  4. Probar con `workflow_dispatch` y `--dry-run`. Recién después, apagar el
     timer local.
- **Lo que configura Luis:**
  - Un environment `videos` en GitHub con estos secretos:
    - `ELEVENLABS_API_KEY`
    - `CORREO_USUARIO`, `CORREO_CLAVE` (la contraseña de aplicación de Gmail)
    - `CORREO_PARA`
    - `CONVEX_DEPLOY_KEY`: la misma que ya usa `deploy-convex.yml` en el
      environment `convex-test`, o una nueva desde el dashboard de Convex.
  - Restringir ese environment a la rama `master`.
  - Para que la publicación diaria (`luiscf1226/short-video-studio`) programe
    estos videos los días de app, en el mismo environment van los secretos
    `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y
    `GOOGLE_OAUTH_REFRESH_TOKEN`. Es el mismo cliente OAuth de Luis, pero el
    token es solo de `drive.file`: toca únicamente lo que crea este script. Los
    guarda `scripts/sacar_refresh_token.py` de aquel repo, con
    `--solo-drive-file --repo luiscf1226/bible-ai-honduras --env videos`.

    La primera corrida crea en el Drive de Luis la carpeta «Bible AI · videos
    para publicar». Luis la comparte como Lector con la cuenta de servicio de
    la publicación diaria y pone su id en `apps[bible-ai].carpeta_drive`.

    Sin esos secretos, el lote solo manda el correo, como antes. Cada video se
    sube como `bible-ai-<fecha>-<dia>-<id>.mp4`, con la fecha para la que se
    hizo. Una corrida que se repite no lo vuelve a subir, y una semana rehecha
    lo reemplaza. Los de tipo `instalar` no se suben: graban la página de
    descarga, que muestra la tienda y el precio.
- **Ojo:**
  - Repo público, así que los logs y los artifacts los puede ver cualquiera.
    Los videos van solo por correo, nunca como artifact, y el log no imprime
    respuestas ni keys.
  - GitHub apaga los cron de un repo público después de 60 días sin actividad
    ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
    Con commits seguidos no pasa, pero si llega a pasar, se reactiva desde la
    pestaña Actions.

## Opción B: una tarea programada de Claude Code en la nube (routine)

Una routine semanal en claude.ai/code que clona el repo, corre el lote y
revisa los cuadros, igual que la tarea de T3 pero sin la laptop.

- **Costo: incluido en la suscripción de Claude** (Pro, Max). Gasta del
  mismo cupo que las sesiones normales, y se pasa a uso extra si se agota
  ([docs de routines](https://code.claude.com/docs/en/routines)). Una corrida
  de ~35 min con revisión de cuadros puede gastar buena parte del cupo de ese
  día.
- **Pasos:**
  1. Crear un entorno de nube con acceso de red "Limited" más los dominios
     `api.elevenlabs.io` y `*.convex.cloud`, y un script de setup con ffmpeg y
     Chrome ([entornos](https://code.claude.com/docs/en/cloud-environments)).
  2. Crear la routine con el prompt del lote.
- **Lo que configura Luis:** las mismas keys como secretos del entorno, la
  conexión con GitHub y la routine.
- **El problema:** la allowlist del entorno es de dominios HTTP. El SMTP de
  Gmail (puerto 465) no pasa por ahí, así que el correo con 60 MB de video
  tendría que salir de otra forma. Además, el Chrome y el Expo de cada corrida
  la hacen lenta y frágil. Le sumaría la revisión de cuadros con IA, pero no
  vale el riesgo para lo principal.

## Opción C: un VPS chico (Hetzner, 2 vCPU / 4 GB)

El mismo timer de systemd que hoy, en un servidor que siempre está prendido.

- **Costo: unos €4–6/mes**, más IVA. El CX22 y sus sucesores subieron de precio
  en abril de 2026 y las fuentes no coinciden: verificá en
  [hetzner.com/cloud](https://www.hetzner.com/cloud).
- **Pasos:**
  1. Crear el servidor (Ubuntu) e instalar Node, ffmpeg y Chrome.
  2. Clonar el repo, correr `npm ci` y `npm run instalar-automatico`.
- **Lo que configura Luis:** la cuenta de Hetzner con tarjeta, una llave SSH,
  copiar `~/.config/3c-videos/` y `npx convex login` en el servidor, y
  mantener el servidor actualizado.

## Recomendación

**Opción A, GitHub Actions.** Es gratis, no hay servidor que mantener y el repo
ya publica así (`deploy-convex.yml`, `release.yml`). Los cambios de código son
chicos: keys por variables de entorno y Convex por deploy key. Lo que hace
Luis es crear el environment `videos` con 5 secretos.

Un mismo PR agregaría el workflow y esos cambios. Se prueba una vez a mano con
`--dry-run`, y se apaga el timer local solo después del primer domingo que
salga bien.
