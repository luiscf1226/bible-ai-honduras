import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveBibleVersion } from "./bibleVersions";
import { hondurasDateKey } from "./devotional";
import { isDue, scheduleAfterReview, scheduleNew } from "./memorizeSchedule";

/**
 * Versículos para memorizar (#158). "Memorizar" desde la hoja de acciones del
 * lector; repaso espaciado (hoy, 3, 7, 21 días) con un ejercicio de completar
 * palabras.
 *
 * Gratis y sin IA: no pasa por `convex/quotas.ts` y el texto sale del corpus
 * (`verses`), nunca se genera. Si el versículo no está en la versión de la
 * persona, `text` es null y no se inventa (regla dura #4).
 */

type VerseRef = { book: string; chapter: number; verse: number };

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

async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const user = await currentUser(ctx);
  if (!user) {
    throw new ConvexError("No autenticado");
  }
  return user._id;
}

function assertVerseRef(ref: VerseRef) {
  if (!Number.isInteger(ref.chapter) || ref.chapter < 1 || !Number.isInteger(ref.verse) || ref.verse < 1) {
    throw new ConvexError("Referencia de versículo inválida");
  }
}

function findRow(ctx: QueryCtx, userId: Id<"users">, ref: VerseRef) {
  return ctx.db
    .query("memoryVerses")
    .withIndex("by_user_verse", (q) =>
      q.eq("userId", userId).eq("book", ref.book).eq("chapter", ref.chapter).eq("verse", ref.verse),
    )
    .unique();
}

/**
 * Todos los versículos que la persona está memorizando, con el texto en su
 * versión. Primero los que tocan hoy, después por fecha del próximo repaso.
 * `today` viaja para que la app calcule "Mañana", "En 3 días"… con el mismo
 * calendario de Honduras.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const today = hondurasDateKey(Date.now());
    const user = await currentUser(ctx);
    if (!user) {
      return { today, dueCount: 0, items: [] };
    }
    const version = resolveBibleVersion(user.bibleVersion);
    const rows = await ctx.db
      .query("memoryVerses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.createdAt - b.createdAt);
    const items = await Promise.all(
      rows.map(async (row) => {
        const verse = await ctx.db
          .query("verses")
          .withIndex("by_ref", (q) =>
            q.eq("version", version).eq("book", row.book).eq("chapter", row.chapter).eq("verse", row.verse),
          )
          .unique();
        return {
          id: row._id,
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          level: row.level,
          nextReview: row.nextReview,
          due: isDue(row, today),
          version,
          text: verse?.text ?? null,
        };
      }),
    );
    return { today, dueCount: items.filter((item) => item.due).length, items };
  },
});

/** Versículos de un capítulo que ya están en Memorizar (para la hoja del lector). */
export const chapterVerses = query({
  args: { book: v.string(), chapter: v.number() },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("memoryVerses")
      .withIndex("by_user_verse", (q) => q.eq("userId", user._id).eq("book", args.book).eq("chapter", args.chapter))
      .collect();
    return rows.map((row) => row.verse);
  },
});

/** Agrega un versículo. Idempotente: si ya estaba, no reinicia su progreso. */
export const add = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    assertVerseRef(args);
    const existing = await findRow(ctx, userId, args);
    if (existing) {
      return { added: false, nextReview: existing.nextReview };
    }
    const state = scheduleNew(hondurasDateKey(Date.now()));
    await ctx.db.insert("memoryVerses", { userId, ...args, ...state, createdAt: Date.now() });
    return { added: true, nextReview: state.nextReview };
  },
});

/** Lo saca de Memorizar (borra la fila y su progreso). */
export const remove = mutation({
  args: { book: v.string(), chapter: v.number(), verse: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await findRow(ctx, userId, args);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { removed: existing !== null };
  },
});

/** Resultado de un repaso: acertar lo espacia, fallar lo vuelve a hoy. */
export const review = mutation({
  args: { id: v.id("memoryVerses"), correct: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) {
      throw new ConvexError("Versículo no encontrado");
    }
    const state = scheduleAfterReview(row, args.correct, hondurasDateKey(Date.now()));
    await ctx.db.patch(row._id, { ...state, lastReviewedAt: Date.now() });
    return state;
  },
});

/** Borra todos los versículos de Memorizar de una persona (borrado de cuenta). */
export async function deleteMemoryVersesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: number; done: boolean }> {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("memoryVerses")
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
}
