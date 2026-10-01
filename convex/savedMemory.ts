import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveBibleVersion } from "./bibleVersions";
import { addDays, hondurasDateKey, parseDateKey } from "./devotional";

/**
 * "Hace un año guardaste…" en el inicio (#172). Como los recuerdos de fotos:
 * una vez por semana trae de vuelta un versículo guardado hace tiempo, con su
 * nota (#167) si la tiene. No usa IA ni cuesta nada.
 *
 * La elección es determinística por persona y semana: el mismo guardado toda
 * la semana, aunque se recargue el inicio. La semana y la antigüedad se miden
 * con el calendario de Honduras, igual que el devocional.
 */

/** Con menos guardados que esto no hay tarjeta: no hay de dónde recordar. */
export const SAVED_MEMORY_MIN_BOOKMARKS = 3;

/** Un guardado tiene que tener al menos esta antigüedad para volver. */
export const SAVED_MEMORY_MIN_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MemoryCandidate = {
  book: string;
  chapter: number;
  verse: number;
  createdAt: number;
};

export type MemoryPick<T extends MemoryCandidate> = {
  bookmark: T;
  /** Años exactos si se guardó esta misma semana de otro año; si no, null. */
  yearsAgo: number | null;
  headline: string;
};

/** Lunes (YYYY-MM-DD) de la semana de Honduras que contiene `now`. */
export function hondurasWeekKey(now: number): string {
  const today = hondurasDateKey(now);
  const weekday = new Date(parseDateKey(today)).getUTCDay(); // 0 = domingo
  return addDays(today, -((weekday + 6) % 7));
}

/** FNV-1a de 32 bits: estable entre ejecuciones, sin depender de Math.random. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function compareCandidates(a: MemoryCandidate, b: MemoryCandidate): number {
  return (
    a.createdAt - b.createdAt ||
    a.book.localeCompare(b.book) ||
    a.chapter - b.chapter ||
    a.verse - b.verse
  );
}

function headlineFor(savedDay: string, today: string, yearsAgo: number | null): string {
  if (yearsAgo !== null) {
    return yearsAgo === 1 ? "Hace un año guardaste…" : `Hace ${yearsAgo} años guardaste…`;
  }
  const days = Math.round((parseDateKey(today) - parseDateKey(savedDay)) / DAY_MS);
  const months = Math.max(1, Math.floor(days / 30));
  if (months < 12) {
    return months === 1 ? "Hace un mes guardaste…" : `Hace ${months} meses guardaste…`;
  }
  const years = Math.floor(months / 12);
  return years === 1 ? "Hace más de un año guardaste…" : `Hace más de ${years} años guardaste…`;
}

/**
 * Elige el guardado de la semana, o null si no toca tarjeta.
 *
 * 1. Menos de `SAVED_MEMORY_MIN_BOOKMARKS` guardados → null.
 * 2. Solo cuentan los guardados de hace `SAVED_MEMORY_MIN_AGE_DAYS` días o más.
 * 3. Primero los que caen en esta misma semana de otro año ("Hace un año…").
 *    Se compara por semana y no por día porque la tarjeta dura la semana.
 * 4. Si no hay, uno de los viejos al azar, sembrado con persona + semana.
 */
export function pickSavedMemory<T extends MemoryCandidate>(
  bookmarks: readonly T[],
  seed: string,
  now: number,
): MemoryPick<T> | null {
  if (bookmarks.length < SAVED_MEMORY_MIN_BOOKMARKS) {
    return null;
  }
  const today = hondurasDateKey(now);
  const cutoff = addDays(today, -SAVED_MEMORY_MIN_AGE_DAYS);
  const old = bookmarks
    .map((bookmark) => ({ bookmark, day: hondurasDateKey(bookmark.createdAt) }))
    .filter((entry) => entry.day <= cutoff)
    .sort((a, b) => compareCandidates(a.bookmark, b.bookmark));
  if (old.length === 0) {
    return null;
  }

  const week = hondurasWeekKey(now);
  // MM-DD de cada día de esta semana → su año. Una semana puede cruzar el
  // 31 de diciembre, por eso cada día guarda el suyo.
  const weekDays = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(week, i);
    weekDays.set(day.slice(5), Number(day.slice(0, 4)));
  }
  const sameWeek = old.flatMap((entry) => {
    const year = weekDays.get(entry.day.slice(5));
    // Tiene más de 30 días y cae en esta semana del calendario: es de otro año.
    return year === undefined ? [] : [{ ...entry, yearsAgo: year - Number(entry.day.slice(0, 4)) }];
  });

  const key = hash(`${seed}|${week}`);
  if (sameWeek.length > 0) {
    const chosen = sameWeek[key % sameWeek.length];
    return {
      bookmark: chosen.bookmark,
      yearsAgo: chosen.yearsAgo,
      headline: headlineFor(chosen.day, today, chosen.yearsAgo),
    };
  }
  const chosen = old[key % old.length];
  return { bookmark: chosen.bookmark, yearsAgo: null, headline: headlineFor(chosen.day, today, null) };
}

async function currentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * La tarjeta del inicio de esta semana, o null si no toca: sin sesión, apagada
 * en Ajustes, cerrada esta semana ("Ahora no"), menos de 3 guardados o ninguno
 * con más de 30 días. La nota viaja solo a su dueña o dueño, como en
 * `reading.bookmarks`.
 */
export const thisWeek = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user || user.savedMemoryEnabled === false) {
      return null;
    }
    const now = Date.now();
    const week = hondurasWeekKey(now);
    if (user.savedMemoryDismissedWeek === week) {
      return null;
    }
    const rows = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const pick = pickSavedMemory(rows, user._id, now);
    if (!pick) {
      return null;
    }
    const { book, chapter, verse, createdAt, note } = pick.bookmark;
    const version = resolveBibleVersion(user.bibleVersion);
    const row = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) =>
        q.eq("version", version).eq("book", book).eq("chapter", chapter).eq("verse", verse),
      )
      .unique();
    return {
      week,
      headline: pick.headline,
      yearsAgo: pick.yearsAgo,
      book,
      chapter,
      verse,
      createdAt,
      version,
      // Sin el versículo en el corpus no se inventa texto (regla dura #4).
      text: row?.text ?? null,
      note: note ?? null,
    };
  },
});

async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const user = await currentUser(ctx);
  if (!user) {
    throw new ConvexError("No autenticado");
  }
  return user._id;
}

/**
 * "Ahora no": la tarjeta no vuelve hasta la semana siguiente. El inicio
 * también la llama al abrir el versículo, para que no quede repetida.
 */
export const dismiss = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await ctx.db.patch(userId, { savedMemoryDismissedWeek: hondurasWeekKey(Date.now()) });
  },
});
