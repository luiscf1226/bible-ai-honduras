// Graba la app real (el harness de QA en el navegador) mientras un guion la
// usa: escribe la pregunta, la envía, espera la respuesta. Sale un MP4 de
// 1080×1920 con exactamente lo que se ve en el teléfono.
import { execFileSync, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const MARKETING = resolve(import.meta.dirname, "..");
const REPO = resolve(MARKETING, "..");
const PORT = 8081;
const URL = `http://localhost:${PORT}`;

/** Ancho del teléfono del prototipo (dw:402) llevado a 1080 px de video. */
const VIEWPORT = { width: 402, height: Math.ceil((1920 * 402) / 1080) };
const SCALE = 1080 / 402;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function harnessUp() {
  try {
    return (await fetch(URL)).ok;
  } catch {
    return false;
  }
}

/** Levanta la app con `QA_HARNESS=1` si no está corriendo. Devuelve cómo apagarla. */
export async function startHarness(log = console.log) {
  if (await harnessUp()) return () => {};
  log("Levantando la app (QA harness)…");
  const expo = spawn("npx", ["expo", "start", "--web", "--port", String(PORT)], {
    cwd: REPO,
    env: { ...process.env, QA_HARNESS: "1", CI: "1", BROWSER: "none" },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 180; i++) {
    if (await harnessUp()) return () => process.kill(-expo.pid);
    await sleep(1000);
  }
  process.kill(-expo.pid);
  throw new Error("La app no levantó en 3 minutos (npx expo start --web con QA_HARNESS=1).");
}

function chromePath() {
  return join(MARKETING, "node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell");
}

export async function openBrowser() {
  try {
    return await chromium.launch({ executablePath: chromePath() });
  } catch {
    // La primera vez Remotion todavía no bajó su Chrome.
    execFileSync("npx", ["remotion", "browser", "ensure"], { cwd: MARKETING, stdio: "ignore" });
    return chromium.launch({ executablePath: chromePath() });
  }
}

/**
 * Abre `path` (o `url`, una página que no es la app) con el contenido del
 * video inyectado, graba mientras corre `script(page, mark)` y escribe el MP4
 * en `out`. `date` es el día y la hora que ve la app. Devuelve cuántos
 * segundos se pueden usar y en qué segundo del video pasó cada `mark(nombre)`
 * (por ejemplo, cuándo llegó la respuesta). Con `fromLoad`, graba desde que
 * empieza a cargar: lo que arranca solo al abrir (un reel) no se pierde, y el
 * video se recorta después desde una marca.
 */
export async function record(browser, { path, url, userAgent, content, script, out, date, fromLoad = false }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale: "es-HN",
    timezoneId: "America/Tegucigalpa",
    ...(userAgent ? { userAgent, isMobile: true, hasTouch: true } : {}),
  });
  // La app muestra la fecha (saludo, devocional del día): la del día en que se publica.
  if (date) await context.clock.install({ time: date });
  await context.addInitScript((value) => {
    window.__QA_VIDEO__ = value;
    // La pista de «deslizá» del feed sale una sola vez por teléfono: en el video, ya se vio.
    try {
      localStorage.setItem("feed.swipeHintSeen", "1");
    } catch {}
  }, content ?? {});
  const page = await context.newPage();

  // Capturas de pantalla seguidas (~20 por segundo) en vez del screencast de
  // Chrome: el screencast de chrome-headless-shell da cuadros de 402 px y el
  // video quedaba estirado. Las capturas salen a 1080 px de verdad.
  const frames = [];
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: SCALE, mobile: Boolean(userAgent) });
  let capturing = false;
  let capture = Promise.resolve();
  const startCapture = () => {
    capturing = true;
    capture = (async () => {
      while (capturing) {
        const time = Date.now() / 1000;
        try {
          const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true });
          frames.push({ data, time: (time + Date.now() / 1000) / 2 });
        } catch {
          await sleep(20); // la página todavía no pintó nada
        }
      }
    })();
  };
  if (fromLoad) {
    // Una vuelta sin grabar para que las fotos queden en caché: si no, la
    // primera parte del reel arranca con el fondo vacío mientras bajan.
    await page.goto(url ?? URL + path, { waitUntil: "networkidle", timeout: 180_000 });
    await page.goto("about:blank");
    await page.goto(url ?? URL + path, { waitUntil: "load", timeout: 180_000 });
    // Sin esperar a la red: el guion espera lo que necesita y marca cuándo aparece.
    startCapture();
  } else {
    await page.goto(url ?? URL + path, { waitUntil: "networkidle", timeout: 180_000 });
  }
  // El anillo de foco del navegador no existe en el teléfono.
  await page.addStyleTag({ content: "*:focus, *:focus-visible { outline: none !important; }" });
  if (!fromLoad) {
    await page.waitForTimeout(1500);
    startCapture();
  }
  const started = Date.now() / 1000;
  const marks = {};
  await script(page, (name) => {
    marks[name] = Date.now() / 1000;
  });
  const ended = Date.now() / 1000;
  capturing = false;
  await capture;
  await context.close();
  if (frames.length === 0) throw new Error(`No se grabó ningún cuadro de ${url ?? path}`);

  // Cada cuadro del video (30 por segundo) repite la última captura hasta ese momento.
  const first = Math.min(frames[0].time, started);
  const total = Math.round((ended - first) * 30);
  const ffmpeg = spawn(
    "ffmpeg",
    ["-v", "error", "-y", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", "30", "-i", "-",
      "-vf", "scale=1080:-2,crop=1080:1920:0:0,format=yuv420p",
      "-c:v", "libx264", "-crf", "16", "-preset", "medium", out],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((ok, fail) => ffmpeg.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg salió con ${code}`)))));
  let current = 0;
  for (let index = 0; index < total; index++) {
    const time = first + index / 30;
    while (current + 1 < frames.length && frames[current + 1].time <= time) current++;
    const jpeg = Buffer.from(frames[current].data, "base64");
    if (!ffmpeg.stdin.write(jpeg)) await new Promise((ok) => ffmpeg.stdin.once("drain", ok));
  }
  ffmpeg.stdin.end();
  await done;
  // La duración real del MP4, un cuadro menos: Remotion no puede pedir un cuadro que no existe.
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], { encoding: "utf8" }));
  return {
    seconds: Math.floor(duration * 30 - 1) / 30,
    marks: Object.fromEntries(Object.entries(marks).map(([name, time]) => [name, time - first])),
  };
}

/** Tiempo para leer `text` con calma: ~3 palabras por segundo, entre `min` y `max`. */
export function readingMs(text, min = 5, max = 14) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(max, Math.max(min, words / 3)) * 1000;
}

async function typeAndSend(page, input, question) {
  // Foco directo, como un toque: en Preguntar el estado vacío tapa el campo al
  // calcular dónde cae un clic, aunque en pantalla el campo se ve libre.
  await input.focus();
  await page.waitForTimeout(500);
  await page.keyboard.type(question, { delay: 55 });
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter");
}

/** Espera a que `text` aparezca en la pantalla. */
function waitForText(page, text) {
  return page.waitForFunction((snippet) => document.body.innerText.includes(snippet), text.slice(0, 40), { timeout: 30_000, polling: 100 });
}

/**
 * La app baja sola hasta el final de la respuesta. Como haría alguien que la
 * lee: sube hasta la pregunta y baja despacio durante `ms`.
 */
async function readThread(page, question, ms) {
  await page.waitForTimeout(600);
  const scrolls = await page.evaluate(async ({ question, ms }) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let bubble = null;
    while (walker.nextNode()) if (walker.currentNode.nodeValue.trim() === question) bubble = walker.currentNode.parentElement;
    let scroller = bubble?.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 4 && getComputedStyle(scroller).overflowY !== "visible")) scroller = scroller.parentElement;
    if (!bubble || !scroller) return false;
    const end = scroller.scrollTop;
    const top = Math.max(0, bubble.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12);
    if (end - top < 8) return false;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const animate = (from, to, duration) =>
      new Promise((done) => {
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / duration);
          scroller.scrollTop = from + (to - from) * ease(t);
          if (t < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    await animate(end, top, 900);
    await new Promise((done) => setTimeout(done, 1200));
    await animate(top, end, Math.max(1500, ms - 3000));
    return true;
  }, { question, ms });
  await page.waitForTimeout(scrolls ? 1500 : ms);
}

/**
 * Preguntar: escribe la pregunta, la envía y deja leer la respuesta con su
 * cita. `readMs`: cuánto dura la lectura (la voz, si la hay). Marca "respuesta".
 */
export function preguntaScript({ question, answer, readMs = readingMs(answer) }) {
  return async (page, mark) => {
    await page.waitForTimeout(800);
    await typeAndSend(page, page.getByTestId("qa-input"), question);
    await waitForText(page, answer);
    mark("respuesta");
    await readThread(page, question, readMs);
  };
}

/** Voces: el saludo del personaje, la pregunta, «está escribiendo…» y la respuesta. Marca "respuesta". */
export function personajeScript({ question, reply, readMs = readingMs(reply) }) {
  return async (page, mark) => {
    await page.waitForTimeout(1500);
    await typeAndSend(page, page.getByPlaceholder("Pregúntale algo…"), question);
    await waitForText(page, reply);
    mark("respuesta");
    await readThread(page, question, readMs);
  };
}

/** Una pantalla quieta (o con su propia animación, como el feed) durante `ms`. */
export function holdScript(ms) {
  return (page) => page.waitForTimeout(ms);
}

/**
 * Un reel del feed (historia o monólogo): sus partes avanzan solas con el
 * tiempo de lectura de la app. Marca "parte0", "parte1"… cuando cada una
 * aparece y se queda `holdMs` en la última.
 */
export function reelScript({ scenes, holdMs }) {
  return async (page, mark) => {
    for (const [index, text] of scenes.entries()) {
      await page.waitForFunction(
        (snippet) => [...document.querySelectorAll('[data-testid="reel-text"]')].some((node) => node.textContent.includes(snippet)),
        text.slice(0, 40),
        { timeout: 120_000, polling: 50 },
      );
      mark(`parte${index}`);
    }
    await page.waitForTimeout(holdMs);
  };
}

/**
 * Una página web que se recorre despacio: se queda `holdMs` arriba, baja hasta
 * `selector` en 1.5 s y se queda ahí `readMs`. Marca "abajo" al llegar.
 */
export function scrollToScript({ selector, holdMs, readMs }) {
  return async (page, mark) => {
    await page.waitForTimeout(holdMs);
    await page.evaluate(
      (selector) =>
        new Promise((done) => {
          const target = document.querySelector(selector);
          const from = window.scrollY;
          const to = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 24);
          const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
          const t0 = performance.now();
          const step = (now) => {
            const t = Math.min(1, (now - t0) / 1500);
            window.scrollTo(0, from + (to - from) * ease(t));
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        }),
      selector,
    );
    mark("abajo");
    await page.waitForTimeout(readMs);
  };
}
