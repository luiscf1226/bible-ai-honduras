import { v } from "convex/values";

import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import type { AiUsageGroup } from "./adminKit/aiCalls";
import type { AiMeter } from "./adminKit/meter";

/**
 * Costo y uso de la IA (#235). Cada llamada a Anthropic u OpenAI queda en la
 * tabla `aiCalls` del kit de admin (convex/adminKit): qué parte de la app la
 * hizo, modelo, tokens, costo estimado, latencia y si falló. Sin usuario y sin
 * contenido, igual que la telemetría. Vive 90 días.
 *
 * Ver lo último: `npx convex run aiUsage:summary '{"days":7}'`.
 */

// Lista cerrada: una por función de la app que gasta en un proveedor.
export const AI_FEATURES = ["qa", "feelings", "voices", "group_guide", "stories", "ingest"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_CALLS_RETENTION_DAYS = 90;

export function aiMeter(ctx: Pick<ActionCtx, "runMutation">, feature: AiFeature): AiMeter {
  return async (report) => {
    await ctx.runMutation(components.adminKit.aiCalls.record, { feature, ...report });
  };
}

export const summary = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<AiUsageGroup[]> => {
    const days = args.days !== undefined && args.days > 0 ? args.days : 7;
    return await ctx.runQuery(components.adminKit.aiCalls.summary, { days });
  },
});

export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(components.adminKit.aiCalls.purgeOld, { retentionDays: AI_CALLS_RETENTION_DAYS });
  },
});
