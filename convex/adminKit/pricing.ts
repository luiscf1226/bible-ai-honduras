// Precios de lista en USD por millón de tokens. Es una estimación para el
// dashboard, no la factura: la fuente de verdad son las consolas de cada
// proveedor. Al cambiar un modelo en la app, sumalo acá (el test lo exige).
//
// - Anthropic: platform.claude.com/docs/en/about-claude/pricing
// - OpenAI: openai.com/api/pricing (gpt-image cobra la imagen como tokens de
//   salida; la respuesta de Images trae `usage` con esos tokens)
export type ModelPrice = { inputPerMillion: number; outputPerMillion: number };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "anthropic/claude-sonnet-5": { inputPerMillion: 2, outputPerMillion: 10 },
  "openai/text-embedding-3-small": { inputPerMillion: 0.02, outputPerMillion: 0 },
  "openai/gpt-image-1.5": { inputPerMillion: 5, outputPerMillion: 32 },
};

export function priceFor(provider: string, model: string): ModelPrice | undefined {
  return MODEL_PRICES[`${provider}/${model}`];
}

export function estimateCostUsd(call: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number | undefined {
  const price = priceFor(call.provider, call.model);
  if (!price) return undefined;
  return (call.inputTokens * price.inputPerMillion + call.outputTokens * price.outputPerMillion) / 1_000_000;
}
