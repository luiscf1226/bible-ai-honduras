import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { parseVerseRef } from "../src/lib/parseVerseRef";
import { devotionalForMonthDay, type DevotionalCatalogItem } from "./devotionalCatalog";
import { bibleVersionForIdentity, findVerse } from "./rag/verses";

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_TO_PREPARE = 28;

type Devotional = DevotionalCatalogItem & { date: string };

// Exportadas para que otros módulos (p. ej. `readingPlans.ts`) hagan la misma
// aritmética de fechas en vez de reimplementarla — el plan de lectura anual
// necesita "cuántos días pasaron desde el inicio" con la misma noción de día
// que ya usa el devocional.
export function parseDateKey(date: string): number {
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

export function addDays(date: string, days: number): string {
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

// Un devocional por día del calendario (366, con el 29 de febrero): el mismo
// mes-día trae el mismo devocional todos los años. `date` es la fecha de
// Honduras (`hondurasDateKey`), así que el cambio de día ocurre a la
// medianoche de Tegucigalpa.
export function devotionalForDate(date: string): Devotional {
  parseDateKey(date);
  const [, month, day] = date.split("-").map(Number);
  return { date, ...devotionalForMonthDay(month, day) };
}

const CONTENT_FIELDS = [
  "catalogId",
  "openingPrayer",
  "intro",
  "verseRef",
  "reflection",
  "closingPrayer",
  "imageUrl",
  "imageAlt",
  "imageAttributionUrl",
] as const;

// Filas sembradas por el ciclo de cuatro semanas anterior no traen oración
// inicial, introducción ni oración final: se ignoran y se sirve el catálogo.
function isComplete(row: Doc<"dailyDevotionals">): row is Doc<"dailyDevotionals"> & Devotional {
  return Boolean(row.openingPrayer && row.intro && row.closingPrayer);
}

function matchesCatalog(row: Doc<"dailyDevotionals">, devotional: Devotional): boolean {
  return CONTENT_FIELDS.every((field) => row[field] === devotional[field]);
}

async function storedRow(ctx: QueryCtx, date: string) {
  return await ctx.db
    .query("dailyDevotionals")
    .withIndex("by_date", (q) => q.eq("date", date))
    .first();
}

async function devotionalServedOn(ctx: QueryCtx, date: string): Promise<Devotional> {
  const stored = await storedRow(ctx, date);
  return stored && isComplete(stored) ? stored : devotionalForDate(date);
}

// Campos para `/hoy` (#194): Oración inicial · Introducción · Pasaje ·
// Reflexión · Oración final. El texto del pasaje no viaja acá: se resuelve por
// `verseRef` contra el corpus en la versión de la persona.
function asResponse(devotional: Devotional) {
  return {
    catalogId: devotional.catalogId,
    date: devotional.date,
    openingPrayer: devotional.openingPrayer,
    intro: devotional.intro,
    verseRef: devotional.verseRef,
    reflection: devotional.reflection,
    closingPrayer: devotional.closingPrayer,
    imageAlt: devotional.imageAlt,
    imageAttributionUrl: devotional.imageAttributionUrl,
    imageUrl: devotional.imageUrl,
  };
}

export const today = query({
  args: {},
  handler: async (ctx) => asResponse(await devotionalServedOn(ctx, hondurasDateKey())),
});

export const byDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    parseDateKey(args.date);
    return asResponse(await devotionalServedOn(ctx, args.date));
  },
});

export const WIDGET_DAYS = 14;

/**
 * Versículo del día para el widget de la pantalla del teléfono (#170): hoy y
 * los próximos días, con el texto en la versión de la persona. El widget no
 * corre JS propio a medianoche; la app le deja esta línea de tiempo y el
 * widget avanza solo cada día (hora de Honduras), aun sin conexión. Después del
 * último día sigue mostrando el último que bajó.
 */
export const widgetDays = query({
  args: {},
  handler: async (ctx) => {
    const version = await bibleVersionForIdentity(ctx);
    const startDate = hondurasDateKey();
    const days = [];
    for (let offset = 0; offset < WIDGET_DAYS; offset += 1) {
      const date = addDays(startDate, offset);
      const { verseRef } = await devotionalServedOn(ctx, date);
      const parsed = parseVerseRef(verseRef);
      const verse = parsed ? await findVerse(ctx, { ...parsed, version }) : null;
      days.push({ date, verseRef, text: verse?.text ?? null, version });
    }
    return days;
  },
});

// Solo cron puede llamarla. Deja persistida una ventana de cuatro semanas igual
// al catálogo: inserta los días que faltan y reemplaza los que quedaron
// desactualizados (filas del ciclo anterior o contenido corregido después de
// la revisión pastoral). Repetirla no duplica nada.
export const ensureWindow = internalMutation({
  args: {},
  handler: async (ctx) => {
    const startDate = hondurasDateKey();
    let inserted = 0;
    let updated = 0;

    for (let offset = 0; offset < DAYS_TO_PREPARE; offset += 1) {
      const date = addDays(startDate, offset);
      const devotional = devotionalForDate(date);
      const existing = await storedRow(ctx, date);
      if (!existing) {
        await ctx.db.insert("dailyDevotionals", devotional);
        inserted += 1;
      } else if (!matchesCatalog(existing, devotional)) {
        await ctx.db.replace(existing._id, devotional);
        updated += 1;
      }
    }

    return { inserted, startDate, updated };
  },
});
