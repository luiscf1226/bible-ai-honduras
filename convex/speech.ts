import { AiCallError, type AiMeter, metered } from "./adminKit/meter";
import { openAiErrorKind } from "./images";

/**
 * Voz natural del feed de versículos: lee el texto de RV1909 tal cual, sin
 * agregar ni explicar nada (regla dura #4). Se genera una vez por pasaje y se
 * guarda, así suena igual para todos y no cuesta por cada reproducción.
 */
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
export const SPEECH_MODEL = "gpt-4o-mini-tts";
const SPEECH_VOICE = "sage";
// Una lectura tarda ~4 s; si en un minuto no llegó, se da por caída (no gasta intento).
const SPEECH_TIMEOUT_MS = 60_000;
const SPEECH_INSTRUCTIONS =
  "Leé en español latinoamericano neutro, con voz cálida, serena y pausada, como quien lee la Biblia en voz alta en una iglesia evangélica. " +
  "Pronunciá las formas antiguas tal como están escritas. No agregues palabras ni comentarios.";

// Ritmo aproximado de lectura pausada en español, para estimar el costo: la
// API de voz no devuelve tokens. gpt-4o-mini-tts cobra ~1.250 tokens de audio
// por minuto (precio de lista: USD 0,015/min).
const CHARACTERS_PER_SECOND = 14;
const AUDIO_TOKENS_PER_MINUTE = 1250;

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no está configurada");
  return key;
}

export function estimateSpeechTokens(
  text: string,
  instructions: string = SPEECH_INSTRUCTIONS,
): { inputTokens: number; outputTokens: number } {
  const seconds = text.length / CHARACTERS_PER_SECOND;
  // Las instrucciones de la voz también se cobran como texto de entrada.
  const inputCharacters = text.length + instructions.length;
  return {
    inputTokens: Math.ceil(inputCharacters / 4),
    outputTokens: Math.ceil((seconds / 60) * AUDIO_TOKENS_PER_MINUTE),
  };
}

/**
 * Lee `text` en voz natural. Sin `voice`, la voz del feed de versículos; los
 * reels pasan la del narrador o la del personaje (`feedReelsCore.reelVoice`).
 */
export async function generateSpeech(
  text: string,
  meter?: AiMeter,
  voice: { voice: string; instructions: string } = { voice: SPEECH_VOICE, instructions: SPEECH_INSTRUCTIONS },
): Promise<Blob> {
  return metered(meter, { provider: "openai", model: SPEECH_MODEL }, async (note) => {
    let response: Response;
    try {
      response = await fetch(OPENAI_SPEECH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: SPEECH_MODEL,
          voice: voice.voice,
          input: text,
          instructions: voice.instructions,
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AiCallError("timeout", "OpenAI Speech no respondió a tiempo");
      }
      throw error;
    }
    if (!response.ok) throw new AiCallError(await openAiErrorKind(response), `OpenAI Speech falló: ${response.status}`);
    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0) throw new AiCallError("empty", "OpenAI Speech no devolvió audio");
    note(estimateSpeechTokens(text, voice.instructions));
    return new Blob([audio], { type: "audio/mpeg" });
  });
}
