import { z } from "zod";

// Único módulo que habla con la API de Mensajes de Anthropic. Fetch directo
// (no @anthropic-ai/sdk): el SDK trae resolución de credenciales que hace
// `await import("node:fs")` en su módulo raíz — Convex no puede bundlearlo
// para el runtime de isolate por default, y forzar "use node" en este
// módulo no evitó el error (ver PR #7). No necesitamos nada de eso: acá
// siempre se pasa un API key explícito.
export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
// Modelo elegido en ARCHITECTURE.md §5.1.2 para los 3 módulos conversacionales
// (Q&A, Voces, Sentimiento) — no cambiar sin actualizar ese doc.
export const ANTHROPIC_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada");
  }
  return apiKey;
}

// Salida estructurada (output_config.format, ARCHITECTURE.md §5.1.2): el
// JSON Schema del `schema` de zod restringe la respuesta del modelo, y se
// vuelve a validar acá con el mismo `schema` — hace verificable el paso de
// citación sin parsear texto libre.
export async function generateStructuredAnswer<Schema extends z.ZodType>(params: {
  system: string;
  userPrompt: string;
  schema: Schema;
}): Promise<z.infer<Schema>> {
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
      system: params.system,
      messages: [{ role: "user", content: params.userPrompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: z.toJSONSchema(params.schema, { reused: "ref" }),
        },
      },
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Anthropic no devolvió JSON válido: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = params.schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`La salida estructurada no cumple el schema: ${result.error.message}`);
  }
  return result.data;
}
