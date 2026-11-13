// Hace los videos de una semana del plan, de punta a punta:
//
//   1. lee plan/semanas.json y le hace a la app real cada pregunta de Preguntar
//      y Voces; las respuestas quedan en
//      ~/Work/personal/3c-videos/respuestas/semana-NN.md,
//   2. graba la app real (QA harness) mostrando esas respuestas,
//   3. arma cada video con Remotion en ~/Work/personal/3c-videos/semana-NN/,
//   4. escribe ahí un LEEME.md con la caption de cada publicación, copia todo a
//      ~/Downloads/3c-videos-semana-NN/, manda cada video por correo y avisa.
//
//   node scripts/semana.mjs          # la semana que viene (el domingo, la que empieza mañana)
//                                    # y las semanas cuyas respuestas cambiaron
//   node scripts/semana.mjs 2        # una semana concreta
//   node scripts/semana.mjs --forzar # aunque nada haya cambiado
//   node scripts/semana.mjs 5 6 --ver # qué sale esas semanas, sin grabar
//   node scripts/semana.mjs 1 --reenviar # vuelve a mandar los correos de la semana 1
//
// Si una semana ya se hizo y ni el plan ni sus respuestas cambiaron, no se rehace.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import QRCode from "qrcode";

import { holdScript, openBrowser, personajeScript, preguntaScript, record, reelScript, scrollToScript, startHarness } from "../capture/capture.mjs";
import tokens from "../../design/tokens.json" with { type: "json" };
import { REEL_POOL } from "../../convex/feedReelsCore.ts";
import { voiceCharacters } from "../../convex/voicesCatalog.ts";
import { canMail, mailWeek } from "./correo.mjs";
import { askApp, askCharacter } from "./respuestas.mjs";
import { ANSWER, characterVoice, fitVoice, hasVoice, NARRATOR, PRESENTER, speak, VERSE } from "./voz.mjs";

const MARKETING = resolve(import.meta.dirname, "..");
const REPO = resolve(MARKETING, "..");
const OUT = process.env.VIDEOS_DIR ?? join(homedir(), "Work/personal/3c-videos");
const DOWNLOADS = process.env.DOWNLOADS_DIR ?? join(homedir(), "Downloads");
const plan = JSON.parse(readFileSync(join(MARKETING, "plan/semanas.json"), "utf8"));
const verses = JSON.parse(readFileSync(join(REPO, "qa-harness/mocks/topic-verses.json"), "utf8"));

const DIAS = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };
const pad = (n) => String(n).padStart(2, "0");
const log = (...args) => console.log(`[3c-videos]`, ...args);

// ─── Qué semana ──────────────────────────────────────────────────────────────

/** La semana del plan que toca: el domingo, la que empieza mañana; si no, la de este lunes. */
function upcomingWeek(today = new Date()) {
  const day = today.getDay(); // 0 = domingo
  const monday = new Date(today);
  monday.setDate(today.getDate() + (day === 0 ? 1 : 1 - day));
  const start = new Date(`${plan.inicio}T00:00:00`);
  const weeks = Math.round((monday.setHours(0, 0, 0, 0) - start.getTime()) / (7 * 24 * 3600e3));
  return Math.max(1, weeks + 1);
}

/** Día y hora de publicación de un video (6:30 am, hora de Honduras). */
function postDate(numero, dia) {
  const date = new Date(`${plan.inicio}T06:30:00-06:00`);
  date.setDate(date.getDate() + (numero - 1) * 7 + Object.keys(DIAS).indexOf(dia));
  return date;
}

function weekDates(numero) {
  const monday = new Date(`${plan.inicio}T12:00:00`);
  monday.setDate(monday.getDate() + (numero - 1) * 7);
  const format = (offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    return date.toLocaleDateString("es-HN", { day: "numeric", month: "long" });
  };
  return Object.fromEntries(Object.keys(DIAS).map((dia, offset) => [dia, format(offset)]));
}

// ─── Semanas automáticas ─────────────────────────────────────────────────────
//
// Cuando se acaban las semanas de plan/semanas.json, cada semana se arma sola
// con lo que la app ya trae y no hay que pegar: versículos del feed, historias
// y monólogos de personajes (los reels de convex/feedReelsCore.ts). Va
// rotando, sin repetir lo que ya salió en el plan hasta agotar cada lista.

/** Versículos del feed (qa-harness/mocks/topic-verses.json) para las semanas automáticas. */
const AUTO_VERSES = [
  "Isaías 41:10",
  "Jeremías 29:11",
  "Mateo 11:28",
  "Proverbios 3:5",
  "Salmos 46:1",
  "Romanos 8:28",
  "Isaías 40:31",
  "Lamentaciones 3:22",
  "Juan 14:27",
  "Salmos 34:18",
  "2 Timoteo 1:7",
  "Mateo 6:34",
  "Salmos 121:7",
  "Juan 16:33",
  "Salmos 27:1",
  "Deuteronomio 31:8",
  "Salmos 118:24",
  "1 Pedro 5:7",
  "Sofonías 3:17",
  "Salmos 30:5",
  "Isaías 43:2",
  "Hebreos 13:5",
  "Salmos 55:22",
  "Proverbios 16:3",
  "Filipenses 4:13",
  "Romanos 15:13",
  "Salmos 91:1",
  "Mateo 28:20",
];
const VERSE_POSTS = [
  { gancho: "Guardá este versículo para hoy", texto: "Mandáselo a alguien que lo necesita." },
  { gancho: "Si hoy estás cansado, leé esto", texto: "Etiquetá a quien necesita leerlo hoy." },
  { gancho: "Para empezar la semana con fe", texto: "Guardalo para cuando lo necesités." },
  { gancho: "Este versículo es para vos", texto: "Compartilo con alguien que lo necesita hoy." },
  { gancho: "Leé esto antes de dormir", texto: "Dejá un 🙏 si lo necesitabas." },
];
const SUNDAY_POST = { gancho: "Un versículo para tu domingo", texto: "¿A quién se lo mandarías?" };
const STORY_HOOKS = [(title) => `${title}, en un minuto`, (title) => `¿Conocés la historia de ${title.replace(/^(El|La|Los|Las) /, (article) => article.toLowerCase())}?`];
const MONOLOGUE_HOOKS = [
  (name) => `${name} te cuenta lo que vivió`,
  (name) => `Lo que ${name} nunca olvidó`,
  (name) => `Si ${name} te contara su historia…`,
  (name) => `${name}, en sus propias palabras`,
];

function autoWeek(numero) {
  const used = new Set(plan.semanas.flatMap((semana) => semana.videos.flatMap((video) => [video.reel, video.versiculo].filter(Boolean))));
  const stories = REEL_POOL.filter((reel) => reel.kind === "story" && !used.has(reel.ref));
  // Un personaje distinto cada vez: Moisés 1, David 1, Ester 1… y después Moisés 2.
  const monologues = REEL_POOL.filter((reel) => reel.kind === "character" && !used.has(reel.ref)).sort((a, b) => Number(a.ref.split(":")[2]) - Number(b.ref.split(":")[2]));
  const verses = AUTO_VERSES.filter((ref) => !used.has(ref));
  const n = numero - plan.semanas.length - 1; // 0 en la primera semana automática
  const verse = (dia, i) => {
    const post = dia === "dom" ? SUNDAY_POST : VERSE_POSTS[(2 * n + i) % VERSE_POSTS.length];
    const versiculo = verses[(3 * n + i) % verses.length];
    return { dia, id: slug(versiculo), tipo: "versiculo", versiculo, ...post, cierre: "Un versículo con su imagen, cada día." };
  };
  const story = (dia, i) => {
    const reel = stories[(2 * n + i) % stories.length];
    return {
      dia,
      id: reel.ref.split(":")[1],
      tipo: "historia",
      reel: reel.ref,
      gancho: STORY_HOOKS[(2 * n + i) % STORY_HOOKS.length](reel.title),
      cierre: "Historias de la Biblia, en el feed de 3C.",
      texto: "La historia completa está en 3C.",
    };
  };
  const monologue = (dia, i) => {
    const reel = monologues[(2 * n + i) % monologues.length];
    const name = reel.title;
    return {
      dia,
      id: reel.ref.replace(/^personaje:/, "").replace(":", "-"),
      tipo: "monologo",
      reel: reel.ref,
      gancho: MONOLOGUE_HOOKS[(2 * n + i) % MONOLOGUE_HOOKS.length](name),
      cierre: `Hablá con ${name} en 3C.`,
      texto: `¿Qué le preguntarías vos a ${name}?`,
    };
  };
  return {
    numero,
    automatica: true,
    videos: [verse("lun", 0), story("mar", 0), monologue("mie", 0), verse("jue", 1), story("vie", 1), monologue("sab", 1), verse("dom", 2)],
  };
}

const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** La semana `numero` del plan, o una automática si el plan ya no llega hasta ahí. */
function weekPlan(numero) {
  return plan.semanas.find((item) => item.numero === numero) ?? autoWeek(numero);
}

// ─── Respuestas pegadas ──────────────────────────────────────────────────────

const needsAnswer = (video) => video.tipo === "pregunta" || video.tipo === "personaje";

function characterOf(video) {
  const character = voiceCharacters.find((item) => item.slug === video.personaje);
  if (!character) throw new Error(`${video.id}: «${video.personaje}» no está en convex/voicesCatalog.ts`);
  return character;
}

/** El archivo de respuestas de la semana, con lo que ya haya en `filled`. */
function answersDoc(semana, filled = {}) {
  const lines = [
    `# Semana ${semana.numero}: respuestas para los videos`,
    "",
    "Las respuestas salen solas de la app (el mismo RAG del teléfono). Si querés otra",
    "pregunta, cambiala y borrá su respuesta: se vuelve a preguntar y el video se rehace.",
    "En el video de un comentario, pegá el comentario y la pregunta que te hicieron.",
    "",
  ];
  for (const video of semana.videos.filter(needsAnswer)) {
    const where = video.tipo === "pregunta" ? "Preguntar" : `Voces, ${characterOf(video).name}`;
    const fields = filled[video.id] ?? {};
    lines.push(`## ${video.dia} · ${video.id} (${where})`, "");
    if (video.comentario) lines.push(`Comentario: ${fields.Comentario ?? ""}`);
    lines.push(`Pregunta: ${fields.Pregunta || video.pregunta || ""}`);
    if (video.tipo === "pregunta") lines.push(`Cita: ${fields.Cita ?? ""}`, `Texto de la cita: ${fields["Texto de la cita"] ?? ""}`);
    lines.push("Respuesta:", fields.Respuesta ?? "", "");
  }
  return lines.join("\n");
}

/** Le hace a la app las preguntas que todavía no tienen respuesta y las anota. */
function fillAnswers(semana, text) {
  const filled = parseAnswers(text);
  let asked = false;
  for (const video of semana.videos.filter(needsAnswer)) {
    const fields = (filled[video.id] ??= {});
    const question = fields.Pregunta || video.pregunta;
    if (fields.Respuesta || !question) continue;
    log(`Preguntándole a la app: ${video.id}`);
    try {
      const answer = video.tipo === "pregunta" ? askApp(REPO, question) : askCharacter(REPO, video.personaje, question);
      if (answer) Object.assign(fields, { Pregunta: question, ...answer });
      else log(`${video.id}: la app no encontró qué citar para «${question}».`);
      asked = true;
    } catch (error) {
      log(`${video.id}: no pude preguntarle a la app (${error.message.split("\n")[0]}).`);
    }
  }
  return asked ? answersDoc(semana, filled) : text;
}

/** `## dia · id …` → { Pregunta, Cita, Respuesta, … } de esa sección. */
function parseAnswers(text) {
  const sections = {};
  for (const block of text.split(/^## /m).slice(1)) {
    const [heading, ...body] = block.split("\n");
    const id = heading.split("·")[1]?.trim().split(/\s/)[0];
    if (!id) continue;
    const fields = {};
    let current = null;
    for (const line of body) {
      const match = line.match(/^(Comentario|Pregunta|Cita|Texto de la cita|Respuesta):\s*(.*)$/);
      if (match) {
        current = match[1];
        fields[current] = match[2];
      } else if (current === "Respuesta") {
        fields.Respuesta += `\n${line}`;
      }
    }
    for (const key of Object.keys(fields)) fields[key] = fields[key].trim();
    sections[id] = fields;
  }
  return sections;
}

/** "Filipenses 4:6" → { book, chapter, verse, text } con el texto RV1909 si lo tenemos. */
function parseCitation(reference, pastedText) {
  const match = reference?.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return null;
  const [, book, chapter, verse] = match;
  const text = pastedText || verses[`${book} ${chapter}`]?.[verse];
  if (!text) return null;
  return { book, chapter: Number(chapter), verse: Number(verse), version: "RV1909", text: text.replace(/^Salmo de David\.\s*/, "") };
}

// ─── Grabar y armar cada video ───────────────────────────────────────────────

const HOOK = 2.5;
/** Un teléfono Android cualquiera: la página de descarga pone el APK primero. */
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
// El cierre dura lo suficiente para escanear el QR.
const CLOSING = 5;
const FEATURE = 3.6;
/** Silencio antes de que empiece una voz y después de que termina, en segundos. */
const LEAD_IN = 0.2;
const TAIL = 0.5;

async function buildWeek(semana, answers, browser) {
  const folder = `semana-${pad(semana.numero)}`;
  const capturas = join(MARKETING, "public/capturas", folder);
  rmSync(capturas, { recursive: true, force: true });
  mkdirSync(join(capturas, "voz"), { recursive: true });
  const clip = (id) => ({ file: join(capturas, `${id}.mp4`), src: `capturas/${folder}/${id}.mp4` });
  const results = [];
  const recorded = {};

  /** Genera (o reusa) la voz de `text` y la deja en public/. Sin OPENAI_API_KEY, null. */
  const voz = async (text, voice) => publish(await speak(text, voice, join(OUT, ".voces")));
  /** Copia una voz ya generada a public/, donde Remotion la encuentra. */
  const publish = (spoken) => {
    if (!spoken) return null;
    const name = basename(spoken.file);
    copyFileSync(spoken.file, join(capturas, "voz", name));
    return { src: `capturas/${folder}/voz/${name}`, seconds: spoken.seconds };
  };
  /** Una escena que dura lo que su voz (y nunca menos que `min`). */
  const voiced = (scene, min, spoken) => ({
    ...scene,
    seconds: Math.max(min, spoken ? LEAD_IN + spoken.seconds + TAIL : 0),
    ...(spoken ? { voices: [{ src: spoken.src, at: LEAD_IN }] } : {}),
  });
  const hook = async (scene) => voiced(scene, HOOK, await voz(scene.text, PRESENTER));
  // QR a la página de descarga (App Store y APK), con los colores de la app.
  const qr = `capturas/${folder}/qr-descarga.svg`;
  writeFileSync(join(MARKETING, "public", qr), await QRCode.toString(plan.descarga, { type: "svg", margin: 0, color: { dark: tokens.color.ink, light: tokens.color.surface } }));
  const url = plan.descarga.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const closing = async (lead) => voiced({ kind: "closing", lead, qr, url }, CLOSING, await voz(`${lead} ${plan.cierreVoz}`, PRESENTER));

  for (const video of semana.videos) {
    const pasted = answers[video.id] ?? {};
    const question = pasted.Pregunta || video.pregunta;
    const text = pasted.Respuesta || "";
    // En Voces la respuesta termina con «— Libro cap:vers (RV1909)»: se ve, no se lee.
    const said = text.replace(/\n+—\s[^\n]*$/, "");
    const date = postDate(semana.numero, video.dia);
    if (needsAnswer(video) && !text) {
      const note = question ? "La app no devolvió una respuesta con cita: cambiá la pregunta en el archivo de respuestas." : "Falta el comentario y la pregunta (pegalos en el archivo de respuestas).";
      results.push({ video, status: "falta", note });
      continue;
    }

    if (video.tipo === "pregunta") {
      const citation = parseCitation(pasted.Cita, pasted["Texto de la cita"]);
      const spoken = await voz(said, ANSWER);
      const out = clip(video.id);
      log(`Grabando Preguntar: ${video.id}`);
      const { seconds, marks } = await record(browser, {
        path: "/preguntar",
        date,
        content: { delayMs: 2600, qa: { answer: text, ...(citation ? { citation } : {}) } },
        script: preguntaScript({ question, answer: text, ...(spoken ? { readMs: spoken.seconds * 1000 + 600 } : {}) }),
        out: out.file,
      });
      recorded[video.id] = { ...out, length: seconds };
      const scenes = [
        await hook({ kind: "hook", text: video.comentario && pasted.Comentario ? `«${pasted.Comentario}»` : video.gancho }),
        { kind: "clip", seconds, src: out.src, ...(spoken ? { voices: [{ src: spoken.src, at: marks.respuesta + 0.3 }] } : {}) },
      ];
      if (citation) {
        const reference = `${citation.book} ${citation.chapter}:${citation.verse} · RV1909`;
        scenes.push(voiced({ kind: "verse", text: citation.text, reference }, 6, await voz(citation.text, VERSE)));
      }
      scenes.push(await closing(video.cierre));
      results.push({ video, scenes, note: citation ? null : "Falta la cita (Cita: Libro cap:vers) para la escena del versículo." });
    } else if (video.tipo === "personaje") {
      const character = characterOf(video);
      const spoken = await voz(said, characterVoice(character));
      const out = clip(video.id);
      log(`Grabando Voces: ${video.id}`);
      const { seconds, marks } = await record(browser, {
        path: `/voces/${character.slug}`,
        date,
        content: { delayMs: 2600, voices: { reply: text } },
        script: personajeScript({ question, reply: text, ...(spoken ? { readMs: spoken.seconds * 1000 + 600 } : {}) }),
        out: out.file,
      });
      recorded[video.id] = { ...out, length: seconds };
      results.push({
        video,
        scenes: [
          await hook({ kind: "characterHook", text: video.gancho, character }),
          { kind: "clip", seconds, src: out.src, ...(spoken ? { voices: [{ src: spoken.src, at: marks.respuesta + 0.3 }] } : {}) },
          await closing(video.cierre),
        ],
      });
    } else if (video.tipo === "versiculo") {
      const citation = parseCitation(video.versiculo);
      const spoken = await voz(citation.text, VERSE);
      const out = clip(video.id);
      log(`Grabando el feed: ${video.id}`);
      const { seconds } = await record(browser, {
        path: "/versiculos",
        date,
        content: { feed: { ref: `${citation.book} ${citation.chapter}:${citation.verse}` } },
        script: holdScript(Math.max(8, 1 + (spoken?.seconds ?? 0) + 1.5) * 1000),
        out: out.file,
      });
      results.push({
        video,
        scenes: [await hook({ kind: "hook", text: video.gancho }), { kind: "clip", seconds, src: out.src, ...(spoken ? { voices: [{ src: spoken.src, at: 1 }] } : {}) }, await closing(video.cierre)],
      });
    } else if (video.tipo === "presentacion") {
      results.push({ video }); // se arma al final, con las grabaciones de los otros videos
    } else if (video.tipo === "historia" || video.tipo === "monologo") {
      // Un reel del feed: una historia contada por partes o un personaje en 1ra persona.
      // El texto es el del catálogo de la app (regla dura #4), no hay que pegar nada.
      const reel = REEL_POOL.find((item) => item.ref === video.reel);
      if (!reel) throw new Error(`${video.id}: el reel «${video.reel}» no está en convex/feedReelsCore.ts`);
      const character = reel.kind === "character" ? characterOf({ id: video.id, personaje: reel.voiceSlug }) : null;
      const voice = character ? characterVoice(character) : NARRATOR;
      const spoken = [];
      for (const scene of reel.scenes) spoken.push(await speak(scene.text, voice, join(OUT, ".voces")));
      const out = clip(video.id);
      log(`Grabando el reel: ${video.id}`);
      const { seconds, marks } = await record(browser, {
        path: "/versiculos",
        date,
        fromLoad: true,
        content: { feed: { reel: reel.ref } },
        script: reelScript({ scenes: reel.scenes.map((scene) => scene.text), holdMs: ((spoken.at(-1)?.seconds ?? 4) + 1.5) * 1000 }),
        out: out.file,
      });
      // El clip empieza cuando aparece la primera parte; cada voz, cuando aparece su parte.
      const start = Math.max(0, marks.parte0 - 0.2);
      const voices = [];
      let free = 0;
      for (const [index, part] of spoken.entries()) {
        if (!part) continue;
        const at = Math.max(marks[`parte${index}`] + 0.3, free);
        const next = marks[`parte${index + 1}`];
        const fitted = publish(fitVoice(part, next === undefined ? Infinity : next - at - 0.2));
        voices.push({ src: fitted.src, at: at - start });
        free = at + fitted.seconds + 0.15;
      }
      results.push({
        video,
        scenes: [
          character ? await hook({ kind: "characterHook", text: video.gancho, character }) : await hook({ kind: "hook", text: video.gancho, overline: reel.subtitle }),
          { kind: "clip", seconds: seconds - start, src: out.src, startFrom: start, voices },
          await closing(video.cierre),
        ],
      });
    } else if (video.tipo === "instalar") {
      // La página de descarga como la ve un Android: el APK primero y sus pasos.
      const spoken = await voz(video.voz, PRESENTER);
      const out = clip(video.id);
      log(`Grabando la página de descarga: ${video.id}`);
      const top = 2500;
      const { seconds } = await record(browser, {
        url: pathToFileURL(join(REPO, "site/index.html")).href,
        userAgent: ANDROID,
        date,
        script: scrollToScript({ selector: "#download-android", holdMs: top, readMs: Math.max(5000, ((spoken?.seconds ?? 6) + 1.2) * 1000 - top - 1500) }),
        out: out.file,
      });
      results.push({
        video,
        scenes: [await hook({ kind: "hook", text: video.gancho }), { kind: "clip", seconds, src: out.src, ...(spoken ? { voices: [{ src: spoken.src, at: 0.3 }] } : {}) }, await closing(video.cierre)],
      });
    }
  }

  // La presentación muestra el inicio, el feed y el final de las grabaciones de la semana.
  for (const result of results) {
    if (result.video.tipo !== "presentacion") continue;
    const video = result.video;
    const date = postDate(semana.numero, video.dia);
    const byType = (tipo) => Object.entries(recorded).find(([id]) => semana.videos.find((v) => v.id === id)?.tipo === tipo)?.[1];
    const features = [];
    for (const pantalla of video.pantallas) {
      const scene = voiced({ kind: "feature", step: features.length + 1, text: pantalla.titulo }, FEATURE, await voz(pantalla.voz, PRESENTER));
      if (pantalla.pantalla === "inicio" || pantalla.pantalla === "feed") {
        log(`Grabando la presentación: ${pantalla.pantalla}`);
        const out = clip(`presentacion-${pantalla.pantalla}`);
        const citation = parseCitation(video.versiculo);
        await record(browser, {
          path: pantalla.pantalla === "inicio" ? "/home" : "/versiculos",
          date,
          content: pantalla.pantalla === "feed" ? { feed: { ref: `${citation.book} ${citation.chapter}:${citation.verse}` } } : {},
          script: holdScript((scene.seconds + 0.5) * 1000),
          out: out.file,
        });
        features.push({ ...scene, src: out.src });
      } else {
        const source = byType(pantalla.pantalla);
        if (source) features.push({ ...scene, src: source.src, startFrom: Math.max(0, source.length - scene.seconds - 0.2) });
      }
    }
    result.scenes = [await hook({ kind: "hook", text: video.gancho, overline: video.sobretitulo }), ...features, await closing(video.cierre)];
  }
  return results;
}

/** Volumen al nivel que esperan TikTok e Instagram (-14 LUFS), sin tocar el video. */
function normalizeLoudness(file) {
  const tmp = `${file}.tmp.mp4`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", tmp]);
  renameSync(tmp, file);
}

function render(result, outDir) {
  const name = `${result.video.dia}-${result.video.id}.mp4`;
  const props = join(MARKETING, "public/capturas", `${name}.props.json`);
  writeFileSync(props, JSON.stringify({ scenes: result.scenes }));
  log(`Renderizando ${name}`);
  // Con varias grabaciones de 1080×1920 abiertas, el Chrome del render se queda
  // sin memoria si renderiza en paralelo: un cuadro a la vez, y un reintento.
  const command = ["remotion", "render", "video", join(outDir, name), `--props=${props}`, "--log=error", "--concurrency=1"];
  try {
    execFileSync("npx", command, { cwd: MARKETING, stdio: "inherit" });
  } catch {
    log(`Reintentando ${name}`);
    execFileSync("npx", command, { cwd: MARKETING, stdio: "inherit" });
  }
  if (!process.env.KEEP_PROPS) rmSync(props);
  normalizeLoudness(join(outDir, name));
  return name;
}

/** La caption corta de una publicación: su texto y tres hashtags. */
const caption = (video) => `${video.texto} ${plan.hashtags.split(" ").slice(0, 3).join(" ")}`;

function readme(semana, results) {
  const dates = weekDates(semana.numero);
  const lines = [
    `# Semana ${semana.numero} (lunes ${dates.lun})`,
    "",
    ...(semana.automatica ? ["Semana automática: versículos, historias y personajes que ya trae la app. Para elegir otros, agregala a `marketing/plan/semanas.json`.", ""] : []),
    "Cada video sale en TikTok y como Reel en Instagram el mismo día. La música se agrega al publicar, a volumen bajo debajo de la voz.",
    "",
  ];
  if (!hasVoice()) lines.push("**Sin voz:** falta la key de ElevenLabs en `~/.config/3c-videos/elevenlabs.env`.", "");
  for (const result of results) {
    const { video } = result;
    lines.push(`## ${DIAS[video.dia]} ${dates[video.dia]}: ${video.gancho}`, "");
    if (result.file) lines.push(`Archivo: \`${result.file}\``);
    if (result.status === "falta") lines.push(`**Falta:** ${result.note}`);
    else lines.push("Listo para publicar (revisalo entero antes).");
    if (result.note && !result.status) lines.push(`Ojo: ${result.note}`);
    lines.push("", "Caption:", "", "```", caption(video), "```", "");
  }
  return lines.join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function notify(message) {
  // Sin LD_LIBRARY_PATH: algunas herramientas lo cambian y notify-send no arranca.
  const { LD_LIBRARY_PATH, ...env } = process.env;
  try {
    execFileSync("notify-send", ["-a", "3C videos", "Videos de 3C", message], { env });
  } catch {
    // Sin escritorio (por ejemplo por SSH): queda solo el log.
  }
}

/** Prepara la carpeta de la semana. Devuelve null si nada cambió desde el último render. */
function pending(numero, force) {
  const semana = weekPlan(numero);
  const weekDir = join(OUT, `semana-${pad(numero)}`);
  const answersFile = join(OUT, "respuestas", `semana-${pad(numero)}.md`);
  mkdirSync(weekDir, { recursive: true });
  mkdirSync(join(OUT, "respuestas"), { recursive: true });
  if (!existsSync(answersFile)) writeFileSync(answersFile, answersDoc(semana));
  const saved = readFileSync(answersFile, "utf8");
  const answersText = fillAnswers(semana, saved);
  // Guardar el archivo dispara 3c-videos.path: solo si de verdad cambió.
  if (answersText !== saved) writeFileSync(answersFile, answersText);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO, encoding: "utf8" }).trim();
  const fingerprint = createHash("sha256").update(JSON.stringify(semana)).update(answersText).update(head).update(String(hasVoice())).digest("hex");
  const stateFile = join(weekDir, ".estado");
  if (!force && existsSync(stateFile) && readFileSync(stateFile, "utf8") === fingerprint) return null;
  return { numero, semana, weekDir, answersText, stateFile, fingerprint };
}

const args = process.argv.slice(2);
const force = args.includes("--forzar");
const requested = args.filter((arg) => /^\d+$/.test(arg)).map(Number);
// Sin número: la semana que viene, y cualquier semana cuyas respuestas cambiaron.
const answered = existsSync(join(OUT, "respuestas"))
  ? readdirSync(join(OUT, "respuestas"))
      .map((file) => Number(file.match(/^semana-(\d+)\.md$/)?.[1]))
      .filter(Boolean)
  : [];
const numeros = requested.length ? requested : [...new Set([upcomingWeek(), ...answered])].sort((a, b) => a - b);

// --ver: qué sale cada día de esas semanas, sin grabar nada.
if (args.includes("--ver")) {
  for (const numero of numeros) {
    const semana = weekPlan(numero);
    console.log(`Semana ${numero}${semana.automatica ? " (automática)" : ""}`);
    for (const video of semana.videos) console.log(`  ${DIAS[video.dia].padEnd(9)} ${video.tipo.padEnd(12)} ${video.gancho}  [${video.reel ?? video.versiculo ?? video.cita ?? ""}]`);
  }
  process.exit(0);
}

// Una corrida a la vez: guardar respuestas dispara otra mientras esta graba.
const lockFile = join(OUT, ".corriendo");
const running = () => {
  try {
    const pid = Number(readFileSync(lockFile, "utf8"));
    return pid !== process.pid && process.kill(pid, 0);
  } catch {
    return false;
  }
};
while (running()) {
  log("Hay otra corrida en marcha; espero a que termine.");
  await new Promise((done) => setTimeout(done, 30_000));
}
mkdirSync(OUT, { recursive: true });
writeFileSync(lockFile, String(process.pid));
process.on("exit", () => !running() && rmSync(lockFile, { force: true }));

const jobs = [];
for (const numero of numeros) {
  const job = pending(numero, force);
  if (!job) log(`Semana ${numero}: nada cambió desde el último render.`);
  else jobs.push(job);
}
if (jobs.length) await renderWeeks(jobs);
await mailWeeks(numeros);

async function renderWeeks(jobs) {
  const stopHarness = await startHarness(log);
  const browser = await openBrowser();
  try {
    for (const { numero, semana, weekDir, answersText, stateFile, fingerprint } of jobs) {
      log(`Semana ${numero} → ${weekDir}`);
      const results = await buildWeek(semana, parseAnswers(answersText), browser);
      for (const result of results) if (result.scenes) result.file = render(result, weekDir);
      writeFileSync(join(weekDir, "LEEME.md"), readme(semana, results));
      // Una copia lista para subir en Descargas.
      const downloads = join(DOWNLOADS, `3c-videos-semana-${pad(numero)}`);
      mkdirSync(downloads, { recursive: true });
      for (const file of [...results.filter((r) => r.file).map((r) => r.file), "LEEME.md"]) copyFileSync(join(weekDir, file), join(downloads, file));
      writeFileSync(stateFile, fingerprint);
      const missing = results.filter((result) => result.status).length;
      notify(`Semana ${numero}: ${results.filter((r) => r.file).length} videos en ${weekDir}.` + (missing ? ` ${missing} sin hacer: mirá el LEEME.` : ""));
    }
  } finally {
    await browser.close();
    stopHarness();
  }
}

/**
 * Manda la semana por correo en un solo hilo: el primer mensaje trae todas las
 * captions y cada video va como respuesta en ese hilo (Gmail no acepta más de
 * 25 MB por mensaje). Cada video sale una sola vez; las semanas que ya pasaron
 * no se mandan, salvo que las pidas por número.
 */
async function mailWeeks(numeros) {
  if (!canMail()) {
    log("Sin correo: falta ~/.config/3c-videos/correo.env (ver scripts/correo.mjs).");
    return;
  }
  for (const numero of numeros) {
    if (!requested.includes(numero) && numero < upcomingWeek()) continue;
    const weekDir = join(OUT, `semana-${pad(numero)}`);
    const sentFile = join(weekDir, ".enviados.json");
    const saved = !args.includes("--reenviar") && existsSync(sentFile) ? JSON.parse(readFileSync(sentFile, "utf8")) : {};
    // `hilo`: el Message-ID del primer mensaje; `videos`: los que ya salieron.
    const state = { hilo: saved.hilo ?? null, videos: saved.videos ?? [] };
    const save = () => writeFileSync(sentFile, JSON.stringify(state));
    const dates = weekDates(numero);
    const videos = weekPlan(numero)
      .videos.map((video) => ({ video, name: `${video.dia}-${video.id}.mp4` }))
      .filter(({ name }) => existsSync(join(weekDir, name)));
    const pending = videos.filter(({ name }) => !state.videos.includes(name));
    if (pending.length === 0) continue;
    const day = (video) => `${DIAS[video.dia]} ${dates[video.dia]}`;
    try {
      await mailWeek(
        {
          thread: state.hilo,
          subject: `3C · Semana ${numero} (${dates.lun} al ${dates.dom}): ${videos.length} videos`,
          summary: [
            `Los ${videos.length} videos de la semana ${numero}, cada uno en un mensaje de este hilo. Uno por día, en TikTok y como Reel en Instagram.`,
            "",
            ...videos.flatMap(({ video }) => [`${day(video)}: ${video.gancho}`, caption(video), ""]),
          ].join("\n"),
          videos: pending.map(({ video, name }) => ({ name, file: join(weekDir, name), text: `${day(video)}: ${video.gancho}\n\n${caption(video)}` })),
        },
        weekDir,
        {
          started: (id) => {
            state.hilo = id;
            save();
          },
          sent: (video) => {
            log(`Enviado: ${video.name}`);
            state.videos.push(video.name);
            save();
          },
        },
      );
      notify(`Semana ${numero}: ${pending.length} videos enviados por correo.`);
    } catch (error) {
      log(`No pude mandar el correo: ${error.message}`);
      notify(`Semana ${numero}: no pude mandar los videos por correo. Mirá el log.`);
    }
  }
}
