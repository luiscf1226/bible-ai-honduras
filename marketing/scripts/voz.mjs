// Voces de los videos. Las principales son de ElevenLabs (voces latinas de su
// biblioteca, elegidas de oído); un personaje sin voz elegida usa la de sus
// reels en la app (gpt-4o-mini-tts vía convex/speech.ts). Cada audio se guarda
// por su texto y su voz, así un texto que no cambió no se vuelve a pagar.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { reelVoice } from "../../convex/feedReelsCore.ts";
import { generateSpeech } from "../../convex/speech.ts";

// Las keys viven fuera del repo, solo legibles por tu usuario.
for (const [name, file] of [
  ["OPENAI_API_KEY", "openai.env"],
  ["ELEVENLABS_API_KEY", "elevenlabs.env"],
]) {
  const path = join(homedir(), ".config/3c-videos", file);
  if (process.env[name] || !existsSync(path)) continue;
  const match = readFileSync(path, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  if (match) process.env[name] = match[1].trim();
}

const eleven = (voiceId, name) => ({
  provider: "elevenlabs",
  voiceId,
  name,
  model: "eleven_multilingual_v2",
  settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
});

/**
 * Antonio (biblioteca de ElevenLabs, español latino, conversacional): el
 * gancho, la respuesta de Preguntar, el versículo y el cierre. Una sola voz
 * para que el video no cambie de persona a la mitad.
 */
export const PRESENTER = eleven("htFfPSZGJwjBv1CL0aMD", "Antonio");
/** La respuesta de Preguntar, leída tal cual salió de la app (regla dura #4). */
export const ANSWER = PRESENTER;
export const VERSE = PRESENTER;
/** Quien cuenta las historias del feed. */
export const NARRATOR = PRESENTER;

/**
 * Voces de personajes para los videos, elegidas de oído. Solo personajes
 * humanos (regla dura #2). El que no está acá usa su voz de los reels de la app.
 */
const CHARACTERS = {
  moises: eleven("9TcPbUAhHnAV8mzFDAWU", "El Faraón (abuelo cálido)"),
  david: eleven("YExhVa4bZONzeingloMX", "Juan Carlos"),
  pablo: eleven("94zOad0g7T7K4oa7zhDq", "Mauricio"),
  elias: eleven("l1zE9xgNpUTaQCZzpNJa", "Alberto Rodríguez"),
  ester: eleven("kcQkGnn0HAT2JRDQ4Ljp", "Norah"),
  rut: eleven("cIBxLwfshLYhRB9lCXEg", "Carolina G"),
};

export function characterVoice(character) {
  return CHARACTERS[character.slug] ?? reelVoice({ kind: "character", voiceSlug: character.slug, title: character.name });
}

const canSpeak = (voice) => Boolean(voice?.provider === "elevenlabs" ? process.env.ELEVENLABS_API_KEY : process.env.OPENAI_API_KEY);
export const hasVoice = () => canSpeak(PRESENTER);

/** Una caída de red (DNS, conexión) se reintenta: la corrida del domingo no la vigila nadie. */
async function elevenLabs(text, voice, attempt = 1) {
  try {
    return await elevenLabsOnce(text, voice);
  } catch (error) {
    if (attempt >= 4 || !(error instanceof TypeError)) throw error;
    await new Promise((done) => setTimeout(done, 15_000 * attempt));
    return elevenLabs(text, voice, attempt + 1);
  }
}

async function elevenLabsOnce(text, voice) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: voice.model, language_code: "es", voice_settings: voice.settings }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs falló (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Lee `text` con `voice` y devuelve `{ file, seconds }`, o null si falta la
 * key de esa voz. `cacheDir` guarda los audios ya pagados.
 */
export async function speak(text, voice, cacheDir) {
  if (!canSpeak(voice) || !text?.trim()) return null;
  mkdirSync(cacheDir, { recursive: true });
  const key = createHash("sha256").update(JSON.stringify([voice ?? "verso", text, "recortado"])).digest("hex").slice(0, 20);
  const file = join(cacheDir, `${key}.mp3`);
  if (!existsSync(file)) {
    const raw = `${file}.raw.mp3`;
    const audio =
      voice?.provider === "elevenlabs"
        ? await elevenLabs(text, voice)
        : Buffer.from(await (await generateSpeech(text, undefined, voice)).arrayBuffer());
    writeFileSync(raw, audio);
    // La voz llega con silencio al principio y al final: en un video corto, sobra.
    const trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05";
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-af", `${trim},areverse,${trim},areverse`, "-b:a", "160k", file]);
    rmSync(raw);
  }
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }));
  return { file, seconds };
}

/** Lo más que se acelera una voz para que entre en su parte del reel sin que se note. */
const MAX_TEMPO = 1.3;

/**
 * Una voz que dura más que `seconds` (la parte del reel en la que va) se
 * acelera hasta que entre, sin pasar de MAX_TEMPO. Devuelve `{ file, seconds }`.
 */
export function fitVoice(spoken, seconds) {
  if (!spoken || spoken.seconds <= seconds) return spoken;
  const tempo = Math.min(MAX_TEMPO, spoken.seconds / seconds);
  const file = spoken.file.replace(/\.mp3$/, `-x${tempo.toFixed(3)}.mp3`);
  if (!existsSync(file)) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", spoken.file, "-af", `atempo=${tempo.toFixed(3)}`, "-b:a", "160k", file]);
  return { file, seconds: spoken.seconds / tempo };
}
