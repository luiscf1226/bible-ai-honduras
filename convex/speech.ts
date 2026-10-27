import { AiCallError, type AiMeter, httpErrorKind, metered } from "./adminKit/meter";

/**
 * Voz natural del feed de versículos: lee el texto de RV1909 tal cual, sin
 * agregar ni explicar nada (regla dura #4). Se genera una vez por pasaje y se
 * guarda, así suena igual para todos y no cuesta por cada reproducción.
 */
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
export const SPEECH_MODEL = "gpt-4o-mini-tts";
const SPEECH_VOICE = "sage";
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

export function estimateSpeechTokens(text: string): { inputTokens: number; outputTokens: number } {
  const seconds = text.length / CHARACTERS_PER_SECOND;
  return { inputTokens: Math.ceil(text.length / 4), outputTokens: Math.ceil((seconds / 60) * AUDIO_TOKENS_PER_MINUTE) };
}

export async function generateSpeech(text: string, meter?: AiMeter): Promise<Blob> {
  return metered(meter, { provider: "openai", model: SPEECH_MODEL }, async (note) => {
    const response = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: SPEECH_MODEL,
        voice: SPEECH_VOICE,
        input: text,
        instructions: SPEECH_INSTRUCTIONS,
        response_format: "mp3",
      }),
    });
    if (!response.ok) throw new AiCallError(httpErrorKind(response.status), `OpenAI Speech falló: ${response.status}`);
    const audio = await response.arrayBuffer();
    if (audio.byteLength === 0) throw new AiCallError("empty", "OpenAI Speech no devolvió audio");
    note(estimateSpeechTokens(text));
    return new Blob([audio], { type: "audio/mpeg" });
  });
}
