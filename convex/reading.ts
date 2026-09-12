import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/**
 * Marcador "seguí leyendo" del lector (#113).
 *
 * Leer es gratis: acá no se llama a `convex/quotas.ts` ni se cuenta uso. Pro
 * se queda con lo que cuesta IA (Q&A, Voces, Sentir, Historias).
 *
 * Como en el resto del backend, la llave es `identity.subject`: nadie pasa un
 * userId por argumento (eso sería una IDOR con forma de marcador ajeno).
 */

async function requireUser(ctx: QueryCtx): Promise<{ _id: Id<"users"> } | null> {
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

/** Versículos guardados, del último guardado al primero. */
export const bookmarks = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("readingBookmarks")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({ book: row.book, chapter: row.chapter, verse: row.verse, createdAt: row.createdAt }));
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

/** Borra cada tabla personal que pertenece al módulo de Lectura. */
export async function deleteReadingDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: { progress: number; recents: number; bookmarks: number }; done: boolean }> {
  const deleteRows = async (table: "readingProgress" | "readingRecents" | "readingBookmarks") => {
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
  return {
    deleted: { progress: progress.deleted, recents: recents.deleted, bookmarks: bookmarks.deleted },
    done: progress.done && recents.done && bookmarks.done,
  };
}
