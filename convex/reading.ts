import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveBibleVersion } from "./bibleVersions";

/**
 * Marcador "seguí leyendo" del lector (#113).
 *
 * Leer es gratis: acá no se llama a `convex/quotas.ts` ni se cuenta uso. Pro
 * se queda con lo que cuesta IA (Q&A, Voces, Sentir, Historias).
 *
 * Como en el resto del backend, la llave es `identity.subject`: nadie pasa un
 * userId por argumento (eso sería una IDOR con forma de marcador ajeno).
 */

async function requireUser(ctx: QueryCtx): Promise<{ _id: Id<"users">; bibleVersion?: string } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** Último capítulo leído, o null si todavía no leyó nada (o no hay sesión). */
export const progress = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      return null;
    }
    const row = await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!row) {
      return null;
    }
    return { book: row.book, chapter: row.chapter, updatedAt: row.updatedAt };
  },
});

/**
 * Guarda dónde quedó. Una sola fila por usuario: se parchea, no se acumula —
 * el lector llama a esto en cada cambio de capítulo y un insert por capítulo
 * dejaría miles de filas muertas.
 */
export const saveProgress = mutation({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    if (!Number.isInteger(args.chapter) || args.chapter < 1) {
      throw new ConvexError("chapter debe ser un entero mayor o igual a 1");
    }

    const existing = await ctx.db
      .query("readingProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    const patch = { book: args.book, chapter: args.chapter, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("readingProgress", { userId: user._id, ...patch });
  },
});

/** Capítulos abiertos recientemente, del más nuevo al más antiguo. */
export const recents = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("readingRecents")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, 6)
      .map((row) => ({ book: row.book, chapter: row.chapter, openedAt: row.openedAt }));
  },
});

/** Tope de la nota personal de un guardado (#167). */
export const BOOKMARK_NOTE_MAX_LENGTH = 500;

/**
 * Versículos guardados, del último guardado al primero, con el texto en la
 * versión de la persona (#166). El join con `verses` se hace acá, por `by_ref`,
 * para que el cliente no pida versículo por versículo.
 *
 * `limit` acota cuántos se devuelven con texto (Leer muestra 3); `total` es
 * siempre el conteo completo, para el "Ver todos (N)". Si el versículo no está
 * en el corpus de esa versión, `text` es null: no se inventa texto.
 *
 * La nota va solo a la dueña o el dueño del guardado: esta query no la manda a
 * ningún otro lado, y ningún prompt de IA lee `readingBookmarks`.
 */
export const bookmarks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      return { total: 0, items: [] };
    }
    const rows = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
    const limit = args.limit !== undefined && Number.isInteger(args.limit) && args.limit > 0 ? args.limit : sorted.length;
    const version = resolveBibleVersion(user.bibleVersion);
    const items = await Promise.all(
      sorted.slice(0, limit).map(async (row) => {
        const verse = await ctx.db
          .query("verses")
          .withIndex("by_ref", (q) =>
            q.eq("version", version).eq("book", row.book).eq("chapter", row.chapter).eq("verse", row.verse),
          )
          .unique();
        return {
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          createdAt: row.createdAt,
          version,
          text: verse?.text ?? null,
          note: row.note ?? null,
        };
      }),
    );
    return { total: sorted.length, items };
  },
});

/**
 * Guardados de un capítulo, para que el lector sepa qué versículos ya están
 * guardados y cuáles tienen nota (#167) sin pedirlos uno por uno.
 */
export const chapterBookmarks = query({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user_verse", (q) => q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter))
      .collect();
    return rows.map((row) => ({ verse: row.verse, note: row.note ?? null }));
  },
});

/** Registra un capítulo en Recientes sin crear filas duplicadas. */
export const recordRecent = mutation({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    if (!Number.isInteger(args.chapter) || args.chapter < 1) {
      throw new ConvexError("chapter debe ser un entero mayor o igual a 1");
    }
    const existing = await ctx.db
      .query("readingRecents")
      .withIndex("by_user_chapter", (q) => q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter))
      .unique();
    const openedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { openedAt });
      return existing._id;
    }
    return await ctx.db.insert("readingRecents", { userId: user._id, ...args, openedAt });
  },
});

/** Alterna un versículo guardado, siempre dentro de la identidad autenticada. */
export const toggleBookmark = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    if (!Number.isInteger(args.chapter) || args.chapter < 1 || !Number.isInteger(args.verse) || args.verse < 1) {
      throw new ConvexError("chapter y verse deben ser enteros mayores o iguales a 1");
    }
    const existing = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user_verse", (q) =>
        q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter).eq("verse", args.verse),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("readingBookmarks", { userId: user._id, ...args, createdAt: Date.now() });
    return { saved: true };
  },
});

function assertVerseRef(args: { chapter: number; verse: number }) {
  if (!Number.isInteger(args.chapter) || args.chapter < 1 || !Number.isInteger(args.verse) || args.verse < 1) {
    throw new ConvexError("chapter y verse deben ser enteros mayores o iguales a 1");
  }
}

/**
 * Quita un guardado desde la lista (#166), sin abrir el capítulo. A diferencia
 * de `toggleBookmark`, nunca lo vuelve a crear: dos taps seguidos no deshacen
 * lo que la persona confirmó. Quitar el guardado borra también su nota.
 */
export const removeBookmark = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    assertVerseRef(args);
    const existing = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user_verse", (q) =>
        q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter).eq("verse", args.verse),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { removed: existing !== null };
  },
});

/**
 * Crea, edita o borra la nota personal de un versículo (#167). Guardar una nota
 * también guarda el versículo; una nota vacía borra la nota pero deja el
 * versículo guardado (para quitarlo está `removeBookmark`).
 */
export const setBookmarkNote = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number(), note: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    assertVerseRef(args);
    const note = args.note.trim();
    if (note.length > BOOKMARK_NOTE_MAX_LENGTH) {
      throw new ConvexError(`La nota puede tener hasta ${BOOKMARK_NOTE_MAX_LENGTH} caracteres`);
    }
    const existing = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user_verse", (q) =>
        q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter).eq("verse", args.verse),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { note: note.length > 0 ? note : undefined });
      return { saved: true, note: note.length > 0 ? note : null };
    }
    if (note.length === 0) {
      return { saved: false, note: null };
    }
    await ctx.db.insert("readingBookmarks", {
      userId: user._id,
      book: args.book,
      chapter: args.chapter,
      verse: args.verse,
      createdAt: Date.now(),
      note,
    });
    return { saved: true, note };
  },
});

/**
 * Borra las notas personales sin quitar los guardados. Lo usa "Borrar mi
 * historial" (#167): la nota es texto que la persona escribió, igual que una
 * conversación; el versículo guardado en sí no es historial.
 */
export async function clearBookmarkNotesForUser(ctx: MutationCtx, userId: Id<"users">): Promise<number> {
  const rows = await ctx.db
    .query("readingBookmarks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let cleared = 0;
  for (const row of rows) {
    if (row.note !== undefined) {
      await ctx.db.patch(row._id, { note: undefined });
      cleared += 1;
    }
  }
  return cleared;
}

/**
 * Separador del lector: la cinta que la persona deja a propósito, como en una
 * Biblia de papel. A diferencia de `progress` (que se mueve solo con cada
 * capítulo que se abre), el separador solo cambia cuando la persona lo mueve.
 * null si no hay sesión o si todavía no puso ninguno.
 */
export const separator = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      return null;
    }
    const row = await ctx.db
      .query("readingSeparators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!row) {
      return null;
    }
    return { book: row.book, chapter: row.chapter, verse: row.verse, updatedAt: row.updatedAt };
  },
});

/**
 * Pone (o mueve) el separador. Hay uno solo, igual que la cinta de una Biblia:
 * ponerlo en otro versículo lo saca del anterior.
 */
export const setSeparator = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    if (!Number.isInteger(args.chapter) || args.chapter < 1 || !Number.isInteger(args.verse) || args.verse < 1) {
      throw new ConvexError("chapter y verse deben ser enteros mayores o iguales a 1");
    }
    const existing = await ctx.db
      .query("readingSeparators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    const patch = { book: args.book, chapter: args.chapter, verse: args.verse, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("readingSeparators", { userId: user._id, ...patch });
  },
});

/** Saca el separador. Sin separador puesto es un no-op. */
export const clearSeparator = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    const existing = await ctx.db
      .query("readingSeparators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/**
 * Colores del subrayado (#168). Son llaves de la paleta `highlight` de
 * design/tokens.json; el hex lo resuelve el tema al pintar.
 */
export const HIGHLIGHT_COLORS = ["amber", "sage", "clay", "sand"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

const highlightColor = v.union(v.literal("amber"), v.literal("sage"), v.literal("clay"), v.literal("sand"));

/** Subrayados de un capítulo, para pintarlos en el lector. */
export const highlightsForChapter = query({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("readingHighlights")
      .withIndex("by_user_verse", (q) => q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter))
      .collect();
    return rows.map((row) => ({ verse: row.verse, color: row.color }));
  },
});

/** Todos los subrayados, del último tocado al primero (Leer y Mi espacio). */
export const highlights = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("readingHighlights")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({ book: row.book, chapter: row.chapter, verse: row.verse, color: row.color, updatedAt: row.updatedAt }));
  },
});

/**
 * Subraya un versículo, o le cambia el color si ya estaba subrayado. Subrayar
 * es gratis: no pasa por `convex/quotas.ts`.
 */
export const setHighlight = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number(), color: highlightColor },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    assertVerseRef(args);
    const existing = await ctx.db
      .query("readingHighlights")
      .withIndex("by_user_verse", (q) =>
        q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter).eq("verse", args.verse),
      )
      .unique();
    const updatedAt = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { color: args.color, updatedAt });
      return existing._id;
    }
    return await ctx.db.insert("readingHighlights", { userId: user._id, ...args, updatedAt });
  },
});

/** Quita el subrayado de un versículo. Sin subrayado es un no-op. */
export const clearHighlight = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) {
      throw new ConvexError("No autenticado");
    }
    assertVerseRef(args);
    const existing = await ctx.db
      .query("readingHighlights")
      .withIndex("by_user_verse", (q) =>
        q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter).eq("verse", args.verse),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/** Borra cada tabla personal que pertenece al módulo de Lectura. */
export async function deleteReadingDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{
  deleted: { progress: number; recents: number; bookmarks: number; separators: number; highlights: number };
  done: boolean;
}> {
  const deleteRows = async (
    table: "readingProgress" | "readingRecents" | "readingBookmarks" | "readingSeparators" | "readingHighlights",
  ) => {
    const rowsOf = (limit: number) =>
      ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(limit);
    let deleted = 0;
    while (deleted < budget) {
      const page = await rowsOf(Math.min(budget - deleted, 128));
      if (page.length === 0) {
        return { deleted, done: true };
      }
      for (const row of page) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return { deleted, done: (await rowsOf(1)).length === 0 };
  };

  // El contexto de mutación de Convex se consume de forma secuencial: no se
  // paralelizan deletes que comparten la misma transacción.
  const progress = await deleteRows("readingProgress");
  const recents = await deleteRows("readingRecents");
  const bookmarks = await deleteRows("readingBookmarks");
  const separators = await deleteRows("readingSeparators");
  const highlights = await deleteRows("readingHighlights");
  return {
    deleted: {
      progress: progress.deleted,
      recents: recents.deleted,
      bookmarks: bookmarks.deleted,
      separators: separators.deleted,
      highlights: highlights.deleted,
    },
    done: progress.done && recents.done && bookmarks.done && separators.done && highlights.done,
  };
}
