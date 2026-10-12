import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

/** Suma uno (o `by`) al contador `key` del día `day`. */
export const bump = mutation({
  args: { day: v.string(), key: v.string(), by: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const by = args.by ?? 1;
    const existing = await ctx.db
      .query("counters")
      .withIndex("by_day_key", (q) => q.eq("day", args.day).eq("key", args.key))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { count: existing.count + by });
    else await ctx.db.insert("counters", { day: args.day, key: args.key, count: by });
    return null;
  },
});

/** Contadores entre `fromDay` y `toDay` (YYYY-MM-DD, inclusivos). */
export const range = query({
  args: { fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("counters")
      .withIndex("by_day_key", (q) => q.gte("day", args.fromDay).lte("day", args.toDay))
      .collect();
    return rows.map(({ day, key, count }) => ({ day, key, count }));
  },
});
