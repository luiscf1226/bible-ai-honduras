import { v } from "convex/values";

import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import type { AiUsageGroup } from "./adminKit/aiCalls";
import type { AiMeter } from "./adminKit/meter";
import { addDays, hondurasDateKey } from "./devotional";

/**
 * Costo y uso de la IA (#235). Cada llamada a Anthropic u OpenAI queda en la
 * tabla `aiCalls` del kit de admin (convex/adminKit): qué parte de la app la
 * hizo, modelo, tokens, costo estimado, latencia y si falló. Sin usuario y sin
 * contenido, igual que la telemetría. Vive 90 días.
 *
 * Ver lo último: `npx convex run aiUsage:summary '{"days":7}'` (costo) y
 * `npx convex run aiUsage:outcomes '{"days":7}'` (resultados).
 */

// Lista cerrada: una por función de la app que gasta en un proveedor.
export const AI_FEATURES = ["qa", "feelings", "voices", "group_guide", "stories", "ingest"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_CALLS_RETENTION_DAYS = 90;

/**
 * Qué pasó con la respuesta, aparte del costo: cuántas veces no hubo pasaje,
 * el modelo citó fuera de lo recuperado (cae a la respuesta segura) o el
 * guardrail de Voces frenó el turno. Contadores diarios del kit, sin texto.
 */
export const AI_OUTCOMES = [
  "qa.no_content",
  "qa.ungrounded",
  "feelings.no_content",
  "feelings.ungrounded",
  "voices.refused",
  "voices.no_content",
  "voices.ungrounded",
  "voices.divine_blocked",
  "group_guide.not_grounded",
] as const;
export type AiOutcome = (typeof AI_OUTCOMES)[number];

export function aiMeter(ctx: Pick<ActionCtx, "runMutation">, feature: AiFeature): AiMeter {
  return async (report) => {
    await ctx.runMutation(components.adminKit.aiCalls.record, { feature, ...report });
  };
}

/** Suma uno al contador del día (Honduras). Como medir, nunca rompe el pedido. */
export async function countAiOutcome(ctx: Pick<ActionCtx, "runMutation">, key: AiOutcome): Promise<void> {
  try {
    await ctx.runMutation(components.adminKit.counters.bump, { day: hondurasDateKey(), key });
  } catch (error) {
    console.error("No se pudo contar el resultado de la IA", error);
  }
}

export const summary = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<AiUsageGroup[]> => {
    const days = args.days !== undefined && args.days > 0 ? args.days : 7;
    return await ctx.runQuery(components.adminKit.aiCalls.summary, { days });
  },
});

export type AiOutcomeCount = { day: string; key: string; count: number };

/** Contadores de resultados de los últimos `days` días de Honduras, hoy incluido. */
export const outcomes = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<AiOutcomeCount[]> => {
    const days = args.days !== undefined && args.days > 0 ? args.days : 7;
    const toDay = hondurasDateKey();
    return await ctx.runQuery(components.adminKit.counters.range, { fromDay: addDays(toDay, 1 - days), toDay });
  },
});

export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(components.adminKit.aiCalls.purgeOld, { retentionDays: AI_CALLS_RETENTION_DAYS });
  },
});
