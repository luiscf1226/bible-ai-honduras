import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation } from "./_generated/server";

/**
 * Diagnóstico mínimo: errores de la app y un embudo de eventos sin contenido.
 *
 * Privacidad primero (PRD §8):
 * - **Sin cuenta:** las filas llevan un `installId` aleatorio generado en el
 *   teléfono, nunca el `userId`, el correo ni el `clerkId`. No hay forma de
 *   unir un evento con una persona, así que el borrado de cuenta no tiene nada
 *   que borrar acá.
 * - **Sin contenido:** solo el nombre del evento (de una lista cerrada) y el
 *   módulo. Nunca la pregunta, el sentimiento, la nota ni el versículo.
 * - **90 días:** el cron `purgar-diagnostico` borra lo más viejo.
 *
 * Vive en Convex y no en un servicio de terceros a propósito: no suma una
 * dependencia nativa ni otra cuenta, y los datos no salen de nuestro backend.
 * Los cierres nativos (crash fuera de JS) los siguen reportando TestFlight y
 * Play Console.
 */

export const TELEMETRY_EVENTS = [
  "app_opened",
  "onboarding_completed",
  "qa_asked",
  "voices_message_sent",
  "feeling_devotional_generated",
  "limit_reached",
  "paywall_viewed",
  "purchase_completed",
  "share_completed",
  "reader_voice_opened",
  "update_required_shown",
  "referral_claimed",
  "citation_opened",
  // Oleada UX (#193, #194): tarjetas del inicio y la pantalla del versículo del día.
  "home_card_opened",
  "today_opened",
  // Temporadas (#199) y personaje del mes (#200). Sin la temporada ni el
  // personaje: solo que se vio la franja / se abrió la tarjeta.
  "season_shown",
  "featured_character_opened",
  "bible_downloaded",
  // Un minuto de pausa (#203): solo que se completó. Sin versículo ni conteo.
  "pause_completed",
] as const;
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];

export const TELEMETRY_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const ERROR_MESSAGE_MAX = 300;
const ERROR_STACK_MAX = 2000;
const BUILD_MAX = 16;

const eventName = v.union(...TELEMETRY_EVENTS.map((name) => v.literal(name)));
const telemetryModule = v.union(v.literal("qa"), v.literal("voices"), v.literal("feelings"), v.literal("stories"));
const platform = v.union(v.literal("ios"), v.literal("android"), v.literal("web"));

/** UUID v4 o cualquier id corto alfanumérico: lo que no calza se descarta. */
export function isValidInstallId(value: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(value);
}

export function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export const track = mutation({
  args: {
    installId: v.string(),
    name: eventName,
    module: v.optional(telemetryModule),
    platform,
    build: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Diagnóstico nunca rompe la app: lo inválido se ignora en silencio.
    if (!isValidInstallId(args.installId)) {
      return null;
    }
    await ctx.db.insert("telemetryEvents", {
      installId: args.installId,
      name: args.name,
      module: args.module,
      platform: args.platform,
      build: args.build === undefined ? undefined : truncate(args.build, BUILD_MAX),
      at: Date.now(),
    });
    return null;
  },
});

export const reportError = mutation({
  args: {
    installId: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    fatal: v.boolean(),
    platform,
    build: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isValidInstallId(args.installId)) {
      return null;
    }
    await ctx.db.insert("clientErrors", {
      installId: args.installId,
      message: truncate(args.message, ERROR_MESSAGE_MAX),
      stack: args.stack === undefined ? undefined : truncate(args.stack, ERROR_STACK_MAX),
      fatal: args.fatal,
      platform: args.platform,
      build: args.build === undefined ? undefined : truncate(args.build, BUILD_MAX),
      at: Date.now(),
    });
    return null;
  },
});

/**
 * Embudo de los últimos `days` días: cuántas instalaciones distintas pasaron
 * por cada evento. Se lee desde la terminal:
 *
 *   npx convex run telemetry:funnel '{"days": 7}'
 *
 * Lee todas las filas del rango: alcanza para la beta y el lanzamiento suave.
 * Si el volumen crece, esto pasa a una tabla de agregados diarios.
 */
export const funnel = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days !== undefined && args.days > 0 ? args.days : 7;
    const since = Date.now() - days * DAY_MS;
    const rows = await ctx.db
      .query("telemetryEvents")
      .withIndex("by_at", (q) => q.gte("at", since))
      .collect();
    return summarizeFunnel(rows);
  },
});

export function summarizeFunnel(rows: ReadonlyArray<{ installId: string; name: string }>) {
  const installsByEvent = new Map<string, Set<string>>();
  const eventsByName = new Map<string, number>();
  for (const row of rows) {
    const installs = installsByEvent.get(row.name) ?? new Set<string>();
    installs.add(row.installId);
    installsByEvent.set(row.name, installs);
    eventsByName.set(row.name, (eventsByName.get(row.name) ?? 0) + 1);
  }
  return TELEMETRY_EVENTS.map((name) => ({
    name,
    installs: installsByEvent.get(name)?.size ?? 0,
    events: eventsByName.get(name) ?? 0,
  }));
}

/** Últimos errores, del más nuevo al más viejo: `npx convex run telemetry:recentErrors`. */
export const recentErrors = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit !== undefined && args.limit > 0 ? Math.min(args.limit, 200) : 50;
    const rows = await ctx.db.query("clientErrors").withIndex("by_at").order("desc").take(limit);
    return rows.map(({ message, stack, fatal, platform, build, at }) => ({ message, stack, fatal, platform, build, at }));
  },
});

const PURGE_BATCH = 500;

/**
 * Borra lo que tiene más de 90 días. Una tanda por tabla por corrida; si quedó
 * algo, se reprograma sola hasta terminar.
 */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TELEMETRY_RETENTION_DAYS * DAY_MS;
    const events = await ctx.db
      .query("telemetryEvents")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PURGE_BATCH);
    const errors = await ctx.db
      .query("clientErrors")
      .withIndex("by_at", (q) => q.lt("at", cutoff))
      .take(PURGE_BATCH);
    for (const row of events) await ctx.db.delete(row._id);
    for (const row of errors) await ctx.db.delete(row._id);
    if (events.length === PURGE_BATCH || errors.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.telemetry.purgeOld, {});
    }
    return { events: events.length, errors: errors.length };
  },
});
