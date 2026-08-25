import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Único módulo que habla con la API de Mensajes de Anthropic.
// Modelo elegido en ARCHITECTURE.md §5.1.2 para los 3 módulos conversacionales
// (Q&A, Voces, Sentimiento) — no cambiar sin actualizar ese doc.
export const ANTHROPIC_MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1024;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada");
  }
  return new Anthropic({ apiKey });
}

// Salida estructurada (output_config.format, ARCHITECTURE.md §5.1.2): la
// respuesta se valida contra `schema` en el cliente — hace verificable el
// paso de citación sin parsear texto libre.
export async function generateStructuredAnswer<Schema extends z.ZodType>(params: {
  system: string;
  userPrompt: string;
  schema: Schema;
}): Promise<z.infer<Schema>> {
  const response = await getClient().messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: MAX_TOKENS,
    system: params.system,
    messages: [{ role: "user", content: params.userPrompt }],
    output_config: { format: zodOutputFormat(params.schema) },
  });

  if (!response.parsed_output) {
    throw new Error("Anthropic no devolvió una respuesta estructurada válida");
  }
  return response.parsed_output;
}
