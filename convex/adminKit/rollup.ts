import { v } from "convex/values";

import { query } from "./_generated/server";
import type { MetricRow } from "./contract";

const DAY_MS = 24 * 60 * 60 * 1000;

type Row = Omit<MetricRow, "day">;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/** Suma por dimensión y agrega el total del día (fila sin `dim`). */
function byDim(key: string, values: Map<string, number>): Row[] {
  let total = 0;
  const rows: Row[] = [];
  for (const [dim, value] of values) {
    total += value;
    rows.push({ key, dim, value });
  }
  return [{ key, value: total }, ...rows];
}

function add(map: Map<string, number>, dim: string, value: number) {
  map.set(dim, (map.get(dim) ?? 0) + value);
}

export function aiRows(
  calls: ReadonlyArray<{ feature: string; inputTokens: number; outputTokens: number; costUsd?: number; latencyMs: number; ok: boolean }>,
): Row[] {
  const count = new Map<string, number>();
  const tokens = new Map<string, number>();
  const cost = new Map<string, number>();
  const errors = new Map<string, number>();
  for (const call of calls) {
    add(count, call.feature, 1);
    add(tokens, call.feature, call.inputTokens + call.outputTokens);
    add(cost, call.feature, call.costUsd ?? 0);
    add(errors, call.feature, call.ok ? 0 : 1);
  }
  const latencies = calls.map((call) => call.latencyMs).sort((a, b) => a - b);
  return [
    ...byDim("std.ai_calls", count),
    ...byDim("std.ai_tokens", tokens),
    ...byDim("std.ai_cost_usd", cost),
    ...byDim("std.ai_errors", errors),
    { key: "std.ai_latency_p50_ms", value: percentile(latencies, 50) },
    { key: "std.ai_latency_p95_ms", value: percentile(latencies, 95) },
  ];
}

export function eventRows(
  events: ReadonlyArray<{ installId: string; name: string; at: number }>,
  window: { startMs: number; endMs: number },
): Row[] {
  const activeSince = (days: number) => {
    const since = window.endMs - days * DAY_MS;
    return new Set(events.filter((event) => event.at >= since && event.at < window.endMs).map((event) => event.installId)).size;
  };
  const installsByName = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.at < window.startMs || event.at >= window.endMs) continue;
    const installs = installsByName.get(event.name) ?? new Set<string>();
    installs.add(event.installId);
    installsByName.set(event.name, installs);
  }
  return [
    { key: "std.active_1d", value: activeSince(1) },
    { key: "std.active_7d", value: activeSince(7) },
    { key: "std.active_30d", value: activeSince(30) },
    // Sin total: sumar teléfonos de eventos distintos no significa nada.
    ...[...installsByName].map(([name, installs]) => ({ key: "std.funnel", dim: name, value: installs.size })),
  ];
}

export function errorRows(errors: ReadonlyArray<{ platform: string; fatal: boolean }>): Row[] {
  const byPlatform = new Map<string, number>();
  for (const error of errors) add(byPlatform, error.platform, 1);
  return [
    ...byDim("std.errors", byPlatform),
    { key: "std.errors_fatal", value: errors.filter((error) => error.fatal).length },
  ];
}

/**
 * Métricas estándar de un día. `startMs`/`endMs` los calcula la app con su zona
 * horaria; los activos de 7 y 30 días son ventanas que terminan en `endMs`.
 *
 * Lee las filas crudas de hasta 30 días de eventos: alcanza para el volumen de
 * hoy. Si crece, los activos pasan a calcularse con un conjunto por día.
 */
export const standard = query({
  args: { day: v.string(), startMs: v.number(), endMs: v.number() },
  handler: async (ctx, args): Promise<Row[]> => {
    const window = { startMs: args.startMs, endMs: args.endMs };
    const events = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.gte("at", args.endMs - 30 * DAY_MS).lt("at", args.endMs))
      .collect();
    const calls = await ctx.db
      .query("aiCalls")
      .withIndex("by_at", (q) => q.gte("at", args.startMs).lt("at", args.endMs))
      .collect();
    const errors = await ctx.db
      .query("errors")
      .withIndex("by_at", (q) => q.gte("at", args.startMs).lt("at", args.endMs))
      .collect();
    const counters = await ctx.db
      .query("counters")
      .withIndex("by_day_key", (q) => q.eq("day", args.day))
      .collect();
    const outcomes = new Map(counters.map((row) => [row.key, row.count]));
    return [...eventRows(events, window), ...aiRows(calls), ...errorRows(errors), ...byDim("std.ai_outcomes", outcomes)];
  },
});
