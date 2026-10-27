import { AiCallError, type AiMeter, httpErrorKind, metered } from "./adminKit/meter";

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
export const STORY_IMAGE_MODEL = "gpt-image-1.5";
// Una imagen tarda ~20 s: si en 2 minutos no llegó, la tanda del feed sigue sin esperar al límite de la acción.
const FEED_IMAGE_TIMEOUT_MS = 120_000;

/**
 * `quota` cuando a la cuenta se le acabó el saldo (OpenAI lo manda como 429,
 * igual que un límite por minuto, pero esperar no lo arregla); si no, `http_<status>`.
 */
export async function openAiErrorKind(response: Response): Promise<string> {
  if (response.status === 429) {
    const body = await response.text().catch(() => "");
    if (/insufficient_quota|credit_balance_exhausted/.test(body)) return "quota";
  }
  return httpErrorKind(response.status);
}

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no está configurada");
  return key;
}

function imageBlob(base64: string, type = "image/png") {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type });
}

type ImagesResponse = {
  data?: Array<{ b64_json?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

async function requestImage(
  body: Record<string, unknown>,
  note: (usage: { inputTokens: number; outputTokens: number }) => void,
  timeoutMs?: number,
) {
  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
      body: JSON.stringify({ model: STORY_IMAGE_MODEL, ...body }),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AiCallError("timeout", "OpenAI Images no respondió a tiempo");
    }
    throw error;
  }
  if (!response.ok) throw new AiCallError(await openAiErrorKind(response), `OpenAI Images falló: ${response.status}`);
  const payload = (await response.json()) as ImagesResponse;
  note({ inputTokens: payload.usage?.input_tokens ?? 0, outputTokens: payload.usage?.output_tokens ?? 0 });
  const image = payload.data?.[0]?.b64_json;
  if (!image) throw new AiCallError("empty", "OpenAI Images no devolvió una imagen");
  return image;
}

// Único adaptador del proveedor. La app nunca recibe la clave ni envía prompts
// arbitrarios: todos provienen del catálogo editorial de stories.ts (historias)
// o de verseFeedMedia.ts (fondos del feed, armados desde el catálogo curado).
export async function generateStoryImage(prompt: string, meter?: AiMeter) {
  return metered(meter, { provider: "openai", model: STORY_IMAGE_MODEL }, async (note) =>
    imageBlob(await requestImage({ prompt, quality: "medium", size: "1024x1024" }, note)),
  );
}

/**
 * Fondo vertical del feed de versículos. WebP comprimido: se baja con datos
 * móviles mientras se desliza, así que pesa una fracción del PNG.
 */
export async function generateFeedImage(prompt: string, meter?: AiMeter) {
  return metered(meter, { provider: "openai", model: STORY_IMAGE_MODEL }, async (note) =>
    imageBlob(
      await requestImage(
        { prompt, quality: "medium", size: "1024x1536", output_format: "webp", output_compression: 72 },
        note,
        FEED_IMAGE_TIMEOUT_MS,
      ),
      "image/webp",
    ),
  );
}
