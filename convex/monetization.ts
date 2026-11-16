import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { addDays, hondurasDateKey } from "./devotional";

/**
 * Métricas del freemium en una sola consulta, desde la terminal:
 *
 *   npx convex run monetization:report '{"days": 7}'
 *
 * Lee la foto diaria que arma `adminAdapter.rollupDay` (cada hora, hoy y
 * ayer); el dashboard de admin muestra lo mismo. Solo agregados: ninguna fila
 * dice quién es quién.
 */
export const REPORT_KEYS = [
  "users.active_1d",
  "users.active_7d",
  "users.active_30d",
  "quota.usage",
  "quota.limit_hit",
  "pro.active",
  "pro.new",
  "pro.conversion",
  "pro.conversion_after_limit",
] as const;

export type ReportDay = { day: string } & Record<string, number | Record<string, number>>;

export function reportDays(rows: ReadonlyArray<{ day: string; key: string; dim?: string; value: number }>): ReportDay[] {
  const byDay = new Map<string, ReportDay>();
  for (const row of rows) {
    const entry = byDay.get(row.day) ?? ({ day: row.day } as ReportDay);
    if (row.dim === undefined) {
      entry[row.key] = row.value;
    } else {
      const field = `${row.key}.by`;
      const dims = (entry[field] as Record<string, number> | undefined) ?? {};
      dims[row.dim] = row.value;
      entry[field] = dims;
    }
    byDay.set(row.day, entry);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}

export const report = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ReportDay[]> => {
    const days = Math.min(Math.max(1, Math.floor(args.days ?? 7)), 90);
    const to = hondurasDateKey();
    const rows = await ctx.runQuery(components.adminKit.metrics.read, {
      from: addDays(to, 1 - days),
      to,
      keys: [...REPORT_KEYS],
    });
    return reportDays(rows);
  },
});
