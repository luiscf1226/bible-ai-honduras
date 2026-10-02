import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { hondurasDateKey, parseDateKey } from "./devotional";
import { findReadingPlan } from "./readingPlanCatalog";
import schema from "./schema";
import { findStoryById } from "./stories";
import { findTextStoryById } from "./textStoriesCatalog";
import { voiceCharacters } from "./voicesCatalog";

/**
 * Temporadas (#199): un paquete por época que todos los módulos leen.
 *
 * Esta es solo la mitad del servidor. La temporada vive en la tabla `seasons`
 * y se carga con `seasons:upsert` desde el dashboard o `npx convex run`, así
 * que cambiar de mes no pide publicar un build. La app (tema, inicio,
 * destacados) todavía no la lee: eso entra cuando el diseño de cada temporada
 * salga de Claude Design (#190, regla dura #1).
 *
 * - **Sin colores acá.** `paletteKey` es el nombre de una paleta que vivirá en
 *   `design/tokens.json`, nunca un hex. El servidor elige cuál; el tono lo
 *   decide el tema del cliente.
 * - **Sin IA.** Todo es contenido curado; las referencias (recorrido,
 *   personaje, historia) se validan contra los catálogos existentes para que un
 *   error de dedo no llegue a la app.
 * - **Calendario de Honduras.** Las fechas son `YYYY-MM-DD` inclusivas en el
 *   calendario de Honduras (UTC-6, sin horario de verano), igual que el
 *   devocional.
 *
 * Carga de ejemplo (todo opcional salvo slug, nombre, fechas y `enabled`):
 *
 *   npx convex run seasons:upsert '{"slug":"gratitud-2026","name":"Mes de gratitud",
 *     "startDate":"2026-11-01","endDate":"2026-11-30","enabled":true}'
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX = 64;
const NAME_MAX = 60;
const URL_MAX = 500;
const IMAGE_ALT_MAX = 200;
export const SAMPLE_QUESTIONS_MAX = 6;
const SAMPLE_QUESTION_MAX_LENGTH = 200;

/** Campos que se cargan por temporada: los de la tabla menos `updatedAt`. */
const { updatedAt: _updatedAt, ...seasonFields } = schema.tables.seasons.validator.fields;

export type SeasonInput = {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  enabled: boolean;
  priority?: number;
  paletteKey?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageAttributionUrl?: string;
  devotionalCycleId?: string;
  readingPlanId?: string;
  characterSlug?: string;
  storyId?: string;
  sampleQuestions?: string[];
};

type SeasonRange = Pick<SeasonInput, "slug" | "startDate" | "endDate" | "enabled" | "priority">;

function assertSlug(value: string, field: string) {
  if (value.length > SLUG_MAX || !SLUG_PATTERN.test(value)) {
    throw new ConvexError(`${field} debe ser un slug en minúsculas con guiones`);
  }
}

function assertUrl(value: string | undefined, field: string) {
  if (value === undefined) return;
  if (value.length > URL_MAX || !/^https:\/\/\S+$/.test(value)) {
    throw new ConvexError(`${field} debe ser una URL https`);
  }
}

/** Valida y normaliza una temporada antes de guardarla. Lanza ConvexError. */
export function validateSeason(input: SeasonInput): SeasonInput {
  assertSlug(input.slug, "slug");

  const name = input.name.trim();
  if (!name || name.length > NAME_MAX) {
    throw new ConvexError(`name es obligatorio y de hasta ${NAME_MAX} caracteres`);
  }

  if (parseDateKey(input.startDate) > parseDateKey(input.endDate)) {
    throw new ConvexError("startDate no puede ser posterior a endDate");
  }

  if (input.priority !== undefined && !Number.isInteger(input.priority)) {
    throw new ConvexError("priority debe ser un entero");
  }

  if (input.paletteKey !== undefined) assertSlug(input.paletteKey, "paletteKey");
  if (input.devotionalCycleId !== undefined) assertSlug(input.devotionalCycleId, "devotionalCycleId");

  assertUrl(input.imageUrl, "imageUrl");
  assertUrl(input.imageAttributionUrl, "imageAttributionUrl");
  if (input.imageUrl !== undefined && !input.imageAlt?.trim()) {
    throw new ConvexError("imageAlt es obligatorio cuando hay imageUrl");
  }
  if (input.imageAlt !== undefined && input.imageAlt.length > IMAGE_ALT_MAX) {
    throw new ConvexError(`imageAlt es de hasta ${IMAGE_ALT_MAX} caracteres`);
  }

  if (input.readingPlanId !== undefined && !findReadingPlan(input.readingPlanId)) {
    throw new ConvexError(`readingPlanId desconocido: ${input.readingPlanId}`);
  }
  // Solo personajes del catálogo de Voces, que ya es solo de humanos (regla dura #2).
  if (input.characterSlug !== undefined && !voiceCharacters.some((c) => c.slug === input.characterSlug)) {
    throw new ConvexError(`characterSlug desconocido: ${input.characterSlug}`);
  }
  if (input.storyId !== undefined && !findStoryById(input.storyId) && !findTextStoryById(input.storyId)) {
    throw new ConvexError(`storyId desconocido: ${input.storyId}`);
  }

  let sampleQuestions: string[] | undefined;
  if (input.sampleQuestions !== undefined) {
    sampleQuestions = input.sampleQuestions.map((question) => question.trim());
    if (sampleQuestions.length > SAMPLE_QUESTIONS_MAX) {
      throw new ConvexError(`sampleQuestions admite hasta ${SAMPLE_QUESTIONS_MAX} preguntas`);
    }
    if (sampleQuestions.some((q) => !q || q.length > SAMPLE_QUESTION_MAX_LENGTH)) {
      throw new ConvexError(`cada pregunta de ejemplo es de 1 a ${SAMPLE_QUESTION_MAX_LENGTH} caracteres`);
    }
  }

  return {
    ...input,
    name,
    imageAlt: input.imageAlt?.trim(),
    sampleQuestions,
  };
}

function durationDays(season: SeasonRange): number {
  return (parseDateKey(season.endDate) - parseDateKey(season.startDate)) / (24 * 60 * 60 * 1000);
}

/**
 * Elige la temporada activa para una fecha de Honduras, o null.
 *
 * Si varias se pisan: gana la de mayor `priority`; si empatan, la más corta
 * (la más específica, como Semana Santa dentro de un mes); después la que
 * empezó más tarde; al final el slug, para que el resultado sea estable.
 */
export function pickActiveSeason<T extends SeasonRange>(seasons: readonly T[], date: string): T | null {
  parseDateKey(date);
  const active = seasons.filter(
    (season) => season.enabled && season.startDate <= date && date <= season.endDate,
  );
  if (active.length === 0) return null;

  return [...active].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      durationDays(a) - durationDays(b) ||
      b.startDate.localeCompare(a.startDate) ||
      a.slug.localeCompare(b.slug),
  )[0];
}

function asResponse(season: Doc<"seasons">) {
  return {
    slug: season.slug,
    name: season.name,
    startDate: season.startDate,
    endDate: season.endDate,
    paletteKey: season.paletteKey ?? null,
    imageUrl: season.imageUrl ?? null,
    imageAlt: season.imageAlt ?? null,
    imageAttributionUrl: season.imageAttributionUrl ?? null,
    devotionalCycleId: season.devotionalCycleId ?? null,
    readingPlanId: season.readingPlanId ?? null,
    characterSlug: season.characterSlug ?? null,
    storyId: season.storyId ?? null,
    sampleQuestions: season.sampleQuestions ?? [],
  };
}

export type CurrentSeason = ReturnType<typeof asResponse>;

/**
 * Temporada activa, o null fuera de temporada (la app se ve como hoy).
 *
 * `date` es el día del cliente en el calendario de Honduras (YYYY-MM-DD),
 * igual que `devotional.byDate`: así la query se vuelve a pedir sola cuando
 * cambia el día. Sin `date` usa el día de Honduras del servidor.
 *
 * Lee por el índice `by_end_date` solo las temporadas que no han terminado, así
 * que las pasadas no cuestan nada aunque se acumulen.
 */
export const current = query({
  args: { date: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CurrentSeason | null> => {
    const date = args.date ?? hondurasDateKey();
    parseDateKey(date);
    const notEnded = await ctx.db
      .query("seasons")
      .withIndex("by_end_date", (q) => q.gte("endDate", date))
      .collect();
    const active = pickActiveSeason(notEnded, date);
    return active ? asResponse(active) : null;
  },
});

/**
 * Crea o reemplaza una temporada por `slug`. Reemplaza la fila completa: un
 * campo opcional que no se manda queda vacío.
 *
 * `internalMutation`: no se puede llamar desde la app, solo desde el dashboard
 * de Convex o `npx convex run seasons:upsert '{...}'`.
 */
export const upsert = internalMutation({
  args: seasonFields,
  handler: async (ctx, args) => {
    const season = validateSeason(args);
    const existing = await ctx.db
      .query("seasons")
      .withIndex("by_slug", (q) => q.eq("slug", season.slug))
      .first();
    const row = { ...season, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.replace(existing._id, row);
      return { slug: season.slug, created: false };
    }
    await ctx.db.insert("seasons", row);
    return { slug: season.slug, created: true };
  },
});

/** Borra una temporada por slug (p. ej. un slug mal escrito). Para apagarla, mejor `enabled: false`. */
export const remove = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("seasons")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!existing) return { removed: false };
    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});

/** Todas las temporadas cargadas, en orden de inicio. Para revisar desde el dashboard. */
export const list = internalQuery({
  args: {},
  handler: async (ctx) => {
    const seasons = await ctx.db.query("seasons").collect();
    return seasons.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.slug.localeCompare(b.slug));
  },
});
