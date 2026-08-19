import { ConvexError, v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { devotionalCatalog, type DevotionalCatalogItem } from "./devotionalCatalog";

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
const DAY_MS = 24 * 60 * 60 * 1000;
const REFERENCE_DATE = "2026-01-01";
const DAYS_TO_PREPARE = 28;

type Devotional = DevotionalCatalogItem & { date: string };

function parseDateKey(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ConvexError("date debe tener formato YYYY-MM-DD");
  }

  const [year, month, day] = date.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ConvexError("date no es una fecha válida");
  }
  return timestamp;
}

function addDays(date: string, days: number): string {
  const result = new Date(parseDateKey(date) + days * DAY_MS);
  return result.toISOString().slice(0, 10);
}

export function hondurasDateKey(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: HONDURAS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function devotionalForDate(date: string): Devotional {
  const differenceInDays = Math.round((parseDateKey(date) - parseDateKey(REFERENCE_DATE)) / DAY_MS);
  const index = ((differenceInDays % devotionalCatalog.length) + devotionalCatalog.length) % devotionalCatalog.length;
  return { date, ...devotionalCatalog[index] };
}

function asResponse(devotional: Devotional) {
  return {
    catalogId: devotional.catalogId,
    date: devotional.date,
    imageAlt: devotional.imageAlt,
    imageAttributionUrl: devotional.imageAttributionUrl,
    imageUrl: devotional.imageUrl,
    reflection: devotional.reflection,
    verseRef: devotional.verseRef,
  };
}

export const today = query({
  args: {},
  handler: async (ctx) => {
    const date = hondurasDateKey();
    const stored = await ctx.db
      .query("dailyDevotionals")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();
    return asResponse(stored ?? devotionalForDate(date));
  },
});

export const byDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    parseDateKey(args.date);
    const stored = await ctx.db
      .query("dailyDevotionals")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    return asResponse(stored ?? devotionalForDate(args.date));
  },
});

// Solo cron puede llamarla. Inserta una ventana de cuatro semanas y puede
// repetirse sin duplicar el contenido ya persistido.
export const ensureWindow = internalMutation({
  args: {},
  handler: async (ctx) => {
    const startDate = hondurasDateKey();
    let inserted = 0;

    for (let offset = 0; offset < DAYS_TO_PREPARE; offset += 1) {
      const date = addDays(startDate, offset);
      const existing = await ctx.db
        .query("dailyDevotionals")
        .withIndex("by_date", (q) => q.eq("date", date))
        .first();
      if (existing) continue;

      await ctx.db.insert("dailyDevotionals", devotionalForDate(date));
      inserted += 1;
    }

    return { inserted, startDate };
  },
});
