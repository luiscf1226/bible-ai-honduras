import { v } from "convex/values";

import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

/**
 * Embudo y errores de la app. La app valida (lista cerrada de eventos,
 * installId bien formado) y recorta antes de llamar: acá solo se guarda, se
 * resume y se purga.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH = 500;

const eventFields = {
  installId: v.string(),
  name: v.string(),
  module: v.optional(v.string()),
  origin: v.optional(v.string()),
  platform: v.string(),
  build: v.optional(v.string()),
};

const errorFields = {
  installId: v.string(),
  message: v.string(),
  stack: v.optional(v.string()),
  fatal: v.boolean(),
  platform: v.string(),
  build: v.optional(v.string()),
};

export const track = mutation({
  args: eventFields,
  handler: async (ctx, args) => {
    await ctx.db.insert("events", { ...args, at: Date.now() });
    return null;
  },
});

export const reportError = mutation({
  args: errorFields,
  handler: async (ctx, args) => {
    await ctx.db.insert("errors", { ...args, at: Date.now() });
    return null;
  },
});

/** Copia filas que ya tienen fecha (migración desde las tablas de la app). */
export const importRows = mutation({
  args: {
    events: v.array(v.object({ ...eventFields, at: v.number() })),
    errors: v.array(v.object({ ...errorFields, at: v.number() })),
  },
  handler: async (ctx, args) => {
    for (const row of args.events) await ctx.db.insert("events", row);
    for (const row of args.errors) await ctx.db.insert("errors", row);
    return null;
  },
});

export type FunnelStep = { name: string; installs: number; events: number };

/** Instalaciones distintas y eventos por nombre, en el orden de `names` (con ceros). */
export function summarizeFunnel(
  rows: ReadonlyArray<{ installId: string; name: string }>,
  names: ReadonlyArray<string>,
): FunnelStep[] {
  const installsByEvent = new Map<string, Set<string>>();
  const eventsByName = new Map<string, number>();
  for (const row of rows) {
    const installs = installsByEvent.get(row.name) ?? new Set<string>();
    installs.add(row.installId);
    installsByEvent.set(row.name, installs);
    eventsByName.set(row.name, (eventsByName.get(row.name) ?? 0) + 1);
  }
  return names.map((name) => ({
    name,
    installs: installsByEvent.get(name)?.size ?? 0,
    events: eventsByName.get(name) ?? 0,
  }));
}

/**
 * Embudo de los últimos `days` días. Lee las filas crudas: alcanza mientras el
 * volumen sea chico; `dailyMetrics` lo reemplaza para rangos largos.
 */
export const funnel = query({
  args: { days: v.number(), names: v.array(v.string()) },
  handler: async (ctx, args) => {
    const since = Date.now() - Math.max(1, args.days) * DAY_MS;
    const rows = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.gte("at", since))
      .collect();
    return summarizeFunnel(rows, args.names);
  },
});

/** Últimos errores, del más nuevo al más viejo. */
export const recentErrors = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit), 200);
    const rows = await ctx.db.query("errors").withIndex("by_at").order("desc").take(limit);
    return rows.map(({ message, stack, fatal, platform, build, at }) => ({ message, stack, fatal, platform, build, at }));
  },
});

/**
 * Borra eventos, errores y contadores de más de `retentionDays`. Una tanda por
 * tabla por corrida; si quedó algo, se reprograma sola hasta terminar.
 */
export const purgeOld = mutation({
  args: { retentionDays: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(1, args.retentionDays) * DAY_MS;
    const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);
    const events = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PURGE_BATCH);
    const errors = await ctx.db
      .query("errors")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PURGE_BATCH);
    const counters = await ctx.db
      .query("counters")
      .withIndex("by_day_key", (q) => q.lt("day", cutoffDay))
      .take(PURGE_BATCH);
    for (const row of events) await ctx.db.delete(row._id);
    for (const row of errors) await ctx.db.delete(row._id);
    for (const row of counters) await ctx.db.delete(row._id);
    if (events.length === PURGE_BATCH || errors.length === PURGE_BATCH || counters.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, api.events.purgeOld, args);
    }
    return { events: events.length, errors: errors.length, counters: counters.length };
  },
});
