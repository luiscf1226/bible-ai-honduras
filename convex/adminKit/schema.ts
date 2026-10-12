import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Una fila por llamada a un proveedor de IA (texto, embeddings, imágenes).
  // Sin usuario y sin contenido: solo qué función de la app la hizo, con qué
  // modelo, cuántos tokens, cuánto tardó y si salió bien. Vive 90 días.
  aiCalls: defineTable({
    // Lo decide la app ("qa", "voices", …): el kit no conoce los módulos.
    feature: v.string(),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    // Costo estimado al momento de la llamada (pricing.ts). Se guarda para que
    // un cambio de precios no reescriba el historial. Sin valor = modelo sin
    // precio conocido.
    costUsd: v.optional(v.number()),
    latencyMs: v.number(),
    ok: v.boolean(),
    // Lista corta y cerrada por la app ("http_429", "invalid_json", …), nunca
    // el mensaje del proveedor: puede traer pedazos del prompt.
    errorKind: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),
});
