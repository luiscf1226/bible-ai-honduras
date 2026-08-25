// Único módulo que habla con la API de Mensajes de Anthropic.

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
// Haiku: la respuesta queda estrictamente acotada al contexto que le damos
// (regla dura #4), es corta (2-4 oraciones) y se llama en cada pregunta de
// un producto freemium con cuota diaria — no necesita el modelo más grande.
export const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;

function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada");
  }
  return apiKey;
}

export async function generateAnswer(system: string, userPrompt: string): Promise<string> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": requireApiKey(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic Messages falló: ${response.status}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((block) => block.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic no devolvió texto");
  }
  return text.trim();
}
