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

/**
 * Borrado en cascada de "Eliminar mi cuenta" (#107). Vive acá para que el
 * dueño de la tabla sea el dueño de su purga; `convex/users.ts` la invoca.
 */
export async function deleteReadingProgressForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: number; done: boolean }> {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("readingProgress")
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
