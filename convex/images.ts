const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
export const STORY_IMAGE_MODEL = "gpt-image-1.5";

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no está configurada");
  return key;
}

function pngBlob(base64: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}

// Único adaptador del proveedor. La app nunca recibe la clave ni envía prompts
// arbitrarios: todos provienen del catálogo editorial de stories.ts.
export async function generateStoryImage(prompt: string) {
  const response = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
    body: JSON.stringify({ model: STORY_IMAGE_MODEL, prompt, quality: "medium", size: "1024x1024" }),
  });
  if (!response.ok) throw new Error(`OpenAI Images falló: ${response.status}`);
  const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const image = payload.data?.[0]?.b64_json;
  if (!image) throw new Error("OpenAI Images no devolvió una imagen PNG");
  return pngBlob(image);
}
