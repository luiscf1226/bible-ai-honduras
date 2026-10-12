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

  // Embudo de la app: eventos de una lista cerrada que define la app. Sin
  // cuenta: `installId` es un id aleatorio del teléfono que no se une con
  // nadie. Sin contenido. Vive 90 días.
  events: defineTable({
    installId: v.string(),
    name: v.string(),
    module: v.optional(v.string()),
    origin: v.optional(v.string()),
    platform: v.string(),
    build: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  // Errores de JS de la app (los cierres nativos los ven TestFlight y Play).
  errors: defineTable({
    installId: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    fatal: v.boolean(),
    platform: v.string(),
    build: v.optional(v.string()),
    at: v.number(),
  }).index("by_at", ["at"]),

  // Contadores diarios del servidor ("voices.refused", "qa.ungrounded"…).
  // `day` lo calcula la app (YYYY-MM-DD en su zona horaria). Vive 90 días.
  counters: defineTable({
    day: v.string(),
    key: v.string(),
    count: v.number(),
  }).index("by_day_key", ["day", "key"]),

  // Foto diaria (contrato v1 de lcf-admin): una fila por día, métrica y
  // dimensión opcional ("qa", "ios", "Juan"…). La recalcula el rollup de la
  // app; el dashboard solo lee esto.
  dailyMetrics: defineTable({
    day: v.string(),
    key: v.string(),
    dim: v.optional(v.string()),
    value: v.number(),
  })
    .index("by_day", ["day"])
    .index("by_key_day", ["key", "day"]),
});
