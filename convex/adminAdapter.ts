import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import { httpAction, internalMutation, type MutationCtx } from "./_generated/server";
import { CONTRACT_VERSION, STANDARD_METRICS, type Manifest, type MetricDescriptor, type MetricRow } from "./adminKit/contract";
import { handleAdminRequest } from "./adminKit/httpHandler";
import { addDays, hondurasDateKey, parseDateKey } from "./devotional";

/**
 * Lo específico de Bible AI para el dashboard de admin (#235). El kit
 * (convex/adminKit) calcula las métricas estándar —activos, embudo, IA,
 * errores— y acá se suman las de esta app: usuarios, Pro, cuotas, lectura y
 * planes. Solo agregados: nunca el texto de una pregunta, oración o nota.
 *
 * - Foto diaria: cron cada hora (hoy y ayer) → `dailyMetrics` del kit.
 * - Reconstruir: `npx convex run adminAdapter:backfill '{"days":30}'`.
 * - HTTP: `/admin/*` con `ADMIN_API_TOKEN` (variable de entorno de Convex).
 */

// Honduras no tiene horario de verano: el día local empieza a las 06:00 UTC.
const HONDURAS_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BACKFILL_DAYS = 90;

const APP_METRICS: Record<string, MetricDescriptor> = {
  "users.total": { label: "Usuarios", format: "number", chart: "kpi" },
  "users.new": { label: "Usuarios nuevos", format: "number", chart: "series" },
  "users.onboarded": { label: "Terminaron el onboarding", format: "number", chart: "kpi" },
  "users.ai_consent": { label: "Aceptaron usar IA", format: "number", chart: "kpi" },
  "users.by_version": { label: "Versión de la Biblia", format: "number", chart: "bars", dimLabel: "Versión", aggregate: "last" },
  "users.referred_new": { label: "Nuevos por invitación", format: "number", chart: "series", dimLabel: "Vía" },
  "pro.active": { label: "Pro activos", format: "number", chart: "kpi" },
  "pro.conversion": { label: "Conversión a Pro", format: "percent", chart: "kpi", aggregate: "last" },
  "quota.usage": { label: "Usos de IA por módulo", format: "number", chart: "series", dimLabel: "Módulo" },
  "bible.chapters_opened": { label: "Capítulos abiertos", format: "number", chart: "topN", dimLabel: "Libro" },
  "bible.highlights_new": { label: "Subrayados nuevos", format: "number", chart: "series" },
  "bible.bookmarks_new": { label: "Marcadores nuevos", format: "number", chart: "series" },
  "bible.memory_new": { label: "Versículos para memorizar nuevos", format: "number", chart: "series" },
  "plans.active_7d": { label: "Planes activos (7 días)", format: "number", chart: "bars", dimLabel: "Plan", aggregate: "last" },
  "plans.streaks": { label: "Rachas de lectura", format: "number", chart: "bars", dimLabel: "Días seguidos", aggregate: "last" },
  "groups.total": { label: "Grupos de lectura", format: "number", chart: "kpi" },
};

export const MANIFEST: Manifest = {
  contractVersion: CONTRACT_VERSION,
  app: { id: "bible-ai-honduras", name: "Bible AI Honduras" },
  sections: [
    {
      title: "Usuarios",
      metrics: ["users.total", "users.new", "std.active_1d", "std.active_7d", "std.active_30d", "users.onboarded", "users.ai_consent", "users.referred_new", "users.by_version"],
    },
    { title: "Pro", metrics: ["pro.active", "pro.conversion"] },
    {
      title: "IA",
      metrics: ["std.ai_cost_usd", "std.ai_calls", "quota.usage", "std.ai_tokens", "std.ai_errors", "std.ai_latency_p50_ms", "std.ai_latency_p95_ms", "std.ai_outcomes"],
    },
    {
      title: "Biblia",
      metrics: ["bible.chapters_opened", "bible.highlights_new", "bible.bookmarks_new", "bible.memory_new", "plans.active_7d", "plans.streaks", "groups.total"],
    },
    { title: "Embudo", metrics: ["std.funnel"] },
    { title: "Salud", metrics: ["std.errors", "std.errors_fatal"] },
  ],
  metrics: { ...STANDARD_METRICS, ...APP_METRICS },
};

export function hondurasDayWindow(day: string): { startMs: number; endMs: number } {
  const startMs = parseDateKey(day) + HONDURAS_UTC_OFFSET_MS;
  return { startMs, endMs: startMs + DAY_MS };
}

type Row = Omit<MetricRow, "day">;

function withTotal(key: string, values: Map<string, number>): Row[] {
  let total = 0;
  const rows: Row[] = [];
  for (const [dim, value] of values) {
    total += value;
    rows.push({ key, dim, value });
  }
  return [{ key, value: total }, ...rows];
}

function tally(values: Iterable<string>): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

export function streakBucket(streak: number): string {
  if (streak <= 0) return "0";
  if (streak < 7) return "1-6";
  if (streak < 30) return "7-29";
  return "30+";
}

/**
 * Métricas propias de un día. `users`, `entitlements`, `userPlanProgress` y
 * `readingGroups` se leen completas (son una fila por persona o grupo): alcanza
 * para el volumen de hoy. Lo "nuevo" usa índices por fecha.
 */
async function appRows(ctx: MutationCtx, day: string, window: { startMs: number; endMs: number }): Promise<Row[]> {
  const { startMs, endMs } = window;
  const inWindow = (at: number) => at >= startMs && at < endMs;

  const users = (await ctx.db.query("users").collect()).filter((user) => user._creationTime < endMs);
  const newUsers = users.filter((user) => inWindow(user._creationTime));
  const entitlements = await ctx.db.query("entitlements").collect();
  const proActive = entitlements.filter(
    (row) => row._creationTime < endMs && row.isPro && (row.expiresAt === undefined || row.expiresAt > endMs),
  ).length;

  const usage = await ctx.db
    .query("usage")
    .withIndex("by_day", (q) => q.eq("day", day))
    .collect();
  const usageByModule = new Map<string, number>();
  for (const row of usage) usageByModule.set(row.module, (usageByModule.get(row.module) ?? 0) + row.count);

  const recents = await ctx.db
    .query("readingRecents")
    .withIndex("by_opened_at", (q) => q.gte("openedAt", startMs).lt("openedAt", endMs))
    .collect();

  const highlights = await ctx.db
    .query("readingHighlights")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", startMs).lt("_creationTime", endMs))
    .collect();
  const bookmarks = await ctx.db
    .query("readingBookmarks")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", startMs).lt("_creationTime", endMs))
    .collect();
  const memory = await ctx.db
    .query("memoryVerses")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", startMs).lt("_creationTime", endMs))
    .collect();

  const progress = (await ctx.db.query("userPlanProgress").collect()).filter((row) => row._creationTime < endMs);
  const activePlans = progress.filter((row) => {
    const lastActivity = row.lastActivityAt ?? row._creationTime;
    return lastActivity >= endMs - 7 * DAY_MS && lastActivity < endMs;
  });
  const groups = (await ctx.db.query("readingGroups").collect()).filter((row) => row.createdAt < endMs);

  return [
    { key: "users.total", value: users.length },
    { key: "users.new", value: newUsers.length },
    { key: "users.onboarded", value: users.filter((user) => user.onboardedAt !== undefined).length },
    { key: "users.ai_consent", value: users.filter((user) => user.aiConsentAt !== undefined).length },
    ...withTotal("users.by_version", tally(users.map((user) => user.bibleVersion))),
    ...withTotal("users.referred_new", tally(newUsers.flatMap((user) => (user.referredBy ? [user.referredVia ?? "link"] : [])))),
    { key: "pro.active", value: proActive },
    { key: "pro.conversion", value: users.length === 0 ? 0 : (proActive / users.length) * 100 },
    ...withTotal("quota.usage", usageByModule),
    ...withTotal("bible.chapters_opened", tally(recents.map((row) => row.book))),
    { key: "bible.highlights_new", value: highlights.length },
    { key: "bible.bookmarks_new", value: bookmarks.length },
    { key: "bible.memory_new", value: memory.length },
    ...withTotal("plans.active_7d", tally(activePlans.map((row) => row.planId))),
    ...withTotal("plans.streaks", tally(activePlans.map((row) => streakBucket(row.currentStreak)))),
    { key: "groups.total", value: groups.length },
  ];
}

/** Recalcula la foto de un día (estándar + Bible AI) y la reemplaza en el kit. */
export const rollupDay = internalMutation({
  args: { day: v.string() },
  handler: async (ctx, args) => {
    const window = hondurasDayWindow(args.day);
    const standard = await ctx.runQuery(components.adminKit.rollup.standard, { day: args.day, ...window });
    const rows = [...standard, ...(await appRows(ctx, args.day, window))];
    await ctx.runMutation(components.adminKit.metrics.store, { day: args.day, rows });
    return { day: args.day, rows: rows.length };
  },
});

/** Hoy (parcial) y ayer (cerrado). Lo corre el cron cada hora. */
export const rollupRecent = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = hondurasDateKey();
    await ctx.scheduler.runAfter(0, internal.adminAdapter.rollupDay, { day: addDays(today, -1) });
    await ctx.scheduler.runAfter(0, internal.adminAdapter.rollupDay, { day: today });
  },
});

/** Reconstruye los últimos `days` días (hasta 90, lo que guarda el diagnóstico). */
export const backfill = internalMutation({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const days = Math.min(Math.max(1, Math.floor(args.days)), MAX_BACKFILL_DAYS);
    const today = hondurasDateKey();
    for (let offset = 0; offset < days; offset++) {
      await ctx.scheduler.runAfter(0, internal.adminAdapter.rollupDay, { day: addDays(today, -offset) });
    }
    return { scheduled: days };
  },
});

export const adminHttp = httpAction(async (ctx, request) =>
  handleAdminRequest(request, {
    token: process.env.ADMIN_API_TOKEN,
    manifest: MANIFEST,
    readMetrics: (query) => ctx.runQuery(components.adminKit.metrics.read, query),
    readErrors: (limit) => ctx.runQuery(components.adminKit.events.recentErrors, { limit }),
  }),
);
