import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const metricRow = v.object({ key: v.string(), dim: v.optional(v.string()), value: v.number() });

/** Reemplaza la foto completa de `day`: recalcular un día nunca duplica filas. */
export const store = mutation({
  args: { day: v.string(), rows: v.array(metricRow) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const row of args.rows) {
      if (!Number.isFinite(row.value)) continue;
      await ctx.db.insert("dailyMetrics", { day: args.day, ...row });
    }
    return { stored: args.rows.length };
  },
});

/** Filas entre `from` y `to` (YYYY-MM-DD, inclusivos); `keys` vacío = todas. */
export const read = query({
  args: { from: v.string(), to: v.string(), keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const rows =
      args.keys.length === 0
        ? await ctx.db
            .query("dailyMetrics")
            .withIndex("by_day", (q) => q.gte("day", args.from).lte("day", args.to))
            .collect()
        : (
            await Promise.all(
              args.keys.map((key) =>
                ctx.db
                  .query("dailyMetrics")
                  .withIndex("by_key_day", (q) => q.eq("key", key).gte("day", args.from).lte("day", args.to))
                  .collect(),
              ),
            )
          ).flat();
    return rows.map(({ day, key, dim, value }) => (dim === undefined ? { day, key, value } : { day, key, dim, value }));
  },
});
