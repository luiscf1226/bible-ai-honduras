import { v } from "convex/values";

import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { estimateCostUsd } from "./pricing";

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH = 500;
const LABEL_MAX = 64;

function label(value: string): string {
  return value.length > LABEL_MAX ? value.slice(0, LABEL_MAX) : value;
}

function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** Registra una llamada. Lo llama la app después de cada request a un proveedor. */
export const record = mutation({
  args: {
    feature: v.string(),
    provider: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    ok: v.boolean(),
    errorKind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = {
      feature: label(args.feature),
      provider: label(args.provider),
      model: label(args.model),
      inputTokens: count(args.inputTokens),
      outputTokens: count(args.outputTokens),
    };
    const costUsd = estimateCostUsd(call);
    await ctx.db.insert("aiCalls", {
      ...call,
      ...(costUsd !== undefined ? { costUsd } : {}),
      latencyMs: count(args.latencyMs),
      ok: args.ok,
      ...(args.errorKind !== undefined ? { errorKind: label(args.errorKind) } : {}),
      at: Date.now(),
    });
    return null;
  },
});

/**
 * Borra lo que tiene más de `retentionDays`. Una tanda por corrida; si quedó
 * algo, se reprograma sola hasta terminar.
 */
export const purgeOld = mutation({
  args: { retentionDays: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(1, args.retentionDays) * DAY_MS;
    const rows = await ctx.db
      .query("aiCalls")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PURGE_BATCH);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, api.aiCalls.purgeOld, args);
    }
    return { deleted: rows.length };
  },
});

export type AiCallRow = {
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  latencyMs: number;
  ok: boolean;
  errorKind?: string;
};

export type AiUsageGroup = {
  feature: string;
  provider: string;
  model: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Llamadas cuyo modelo no tiene precio: su costo no entra en `costUsd`. */
  unpricedCalls: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  errorKinds: Record<string, number>;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/** Agrupa por feature + proveedor + modelo, de mayor a menor costo. */
export function summarizeAiCalls(rows: ReadonlyArray<AiCallRow>): AiUsageGroup[] {
  const groups = new Map<string, { group: AiUsageGroup; latencies: number[] }>();
  for (const row of rows) {
    const key = `${row.feature}|${row.provider}|${row.model}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        group: {
          feature: row.feature,
          provider: row.provider,
          model: row.model,
          calls: 0,
          errors: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          unpricedCalls: 0,
          latencyP50Ms: 0,
          latencyP95Ms: 0,
          errorKinds: {},
        },
        latencies: [],
      };
      groups.set(key, entry);
    }
    const { group, latencies } = entry;
    group.calls += 1;
    group.inputTokens += row.inputTokens;
    group.outputTokens += row.outputTokens;
    if (row.costUsd === undefined) group.unpricedCalls += 1;
    else group.costUsd += row.costUsd;
    if (!row.ok) {
      group.errors += 1;
      const kind = row.errorKind ?? "unknown";
      group.errorKinds[kind] = (group.errorKinds[kind] ?? 0) + 1;
    }
    latencies.push(row.latencyMs);
  }
  return [...groups.values()]
    .map(({ group, latencies }) => {
      const sorted = [...latencies].sort((a, b) => a - b);
      return { ...group, latencyP50Ms: percentile(sorted, 50), latencyP95Ms: percentile(sorted, 95) };
    })
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);
}

/**
 * Resumen de los últimos `days` días. Lee las filas crudas: alcanza mientras el
 * volumen sea chico. La foto diaria (`dailyMetrics`, #235) lo reemplaza para
 * rangos largos.
 */
export const summary = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const since = Date.now() - Math.max(1, args.days) * DAY_MS;
    const rows = await ctx.db
      .query("aiCalls")
      .withIndex("by_at", (q) => q.gte("at", since))
      .collect();
    return summarizeAiCalls(rows);
  },
});
