import { v } from "convex/values";

import { components, internal } from "./_generated/api";
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
 * Desde #235 las filas viven en el kit de admin (convex/adminKit, tablas
 * `events` y `errors`); este archivo valida y recorta antes de guardar.
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

/**
 * De dónde salió un `share_completed` cuando importa distinguirlo (#202:
 * "Dedicar"). Lista cerrada, como los nombres: nunca el texto compartido.
 */
export const SHARE_ORIGINS = ["dedicated"] as const;
export type ShareOrigin = (typeof SHARE_ORIGINS)[number];
export const shareOrigin = v.union(...SHARE_ORIGINS.map((origin) => v.literal(origin)));

export const TELEMETRY_RETENTION_DAYS = 90;

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
    origin: v.optional(shareOrigin),
    platform,
    build: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Diagnóstico nunca rompe la app: lo inválido se ignora en silencio.
    if (!isValidInstallId(args.installId)) {
      return null;
    }
    await ctx.runMutation(components.adminKit.events.track, {
      installId: args.installId,
      name: args.name,
      ...(args.module !== undefined ? { module: args.module } : {}),
      // El origen solo tiene sentido en `share_completed`.
      ...(args.name === "share_completed" && args.origin !== undefined ? { origin: args.origin } : {}),
      platform: args.platform,
      ...(args.build !== undefined ? { build: truncate(args.build, BUILD_MAX) } : {}),
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
    await ctx.runMutation(components.adminKit.events.reportError, {
      installId: args.installId,
      message: truncate(args.message, ERROR_MESSAGE_MAX),
      ...(args.stack !== undefined ? { stack: truncate(args.stack, ERROR_STACK_MAX) } : {}),
      fatal: args.fatal,
      platform: args.platform,
      ...(args.build !== undefined ? { build: truncate(args.build, BUILD_MAX) } : {}),
    });
    return null;
  },
});

export type FunnelStep = { name: string; installs: number; events: number };

/**
 * Embudo de los últimos `days` días: cuántas instalaciones distintas pasaron
 * por cada evento. Se lee desde la terminal:
 *
 *   npx convex run telemetry:funnel '{"days": 7}'
 */
export const funnel = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args): Promise<FunnelStep[]> => {
    const days = args.days !== undefined && args.days > 0 ? args.days : 7;
    return await ctx.runQuery(components.adminKit.events.funnel, { days, names: [...TELEMETRY_EVENTS] });
  },
});

export type RecentError = { message: string; stack?: string; fatal: boolean; platform: string; build?: string; at: number };

/** Últimos errores, del más nuevo al más viejo: `npx convex run telemetry:recentErrors`. */
export const recentErrors = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RecentError[]> => {
    const limit = args.limit !== undefined && args.limit > 0 ? Math.min(args.limit, 200) : 50;
    return await ctx.runQuery(components.adminKit.events.recentErrors, { limit });
  },
});

const MIGRATE_BATCH = 200;

/**
 * Mueve las filas de `telemetryEvents` y `clientErrors` (antes de #235) al kit
 * de admin, conservando su fecha, y las borra de la app. Una tanda por corrida;
 * se reprograma sola hasta vaciarlas. La dispara `purgeOld` (cron diario), así
 * que no hace falta correrla a mano. Cuando las dos tablas estén vacías en
 * producción se pueden quitar del schema.
 */
export const migrateToKit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("telemetryEvents").take(MIGRATE_BATCH);
    const errors = await ctx.db.query("clientErrors").take(MIGRATE_BATCH);
    if (events.length === 0 && errors.length === 0) {
      return { events: 0, errors: 0 };
    }
    await ctx.runMutation(components.adminKit.events.importRows, {
      events: events.map(({ installId, name, module, origin, platform, build, at }) => ({
        installId,
        name,
        ...(module !== undefined ? { module } : {}),
        ...(origin !== undefined ? { origin } : {}),
        platform,
        ...(build !== undefined ? { build } : {}),
        at,
      })),
      errors: errors.map(({ installId, message, stack, fatal, platform, build, at }) => ({
        installId,
        message,
        ...(stack !== undefined ? { stack } : {}),
        fatal,
        platform,
        ...(build !== undefined ? { build } : {}),
        at,
      })),
    });
    for (const row of events) await ctx.db.delete(row._id);
    for (const row of errors) await ctx.db.delete(row._id);
    if (events.length === MIGRATE_BATCH || errors.length === MIGRATE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.telemetry.migrateToKit, {});
    }
    return { events: events.length, errors: errors.length };
  },
});

/** Borra lo que tiene más de 90 días (y termina de migrar lo que quede). */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.telemetry.migrateToKit, {});
    return await ctx.runMutation(components.adminKit.events.purgeOld, { retentionDays: TELEMETRY_RETENTION_DAYS });
  },
});
