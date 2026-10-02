import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/**
 * Diario de oración privado (#159). Peticiones con fecha que se pueden marcar
 * como respondidas, con una nota opcional.
 *
 * Mismo criterio de privacidad que Sentir:
 * - Nada se comparte ni se publica.
 * - **Nunca se manda a la IA**: ningún prompt (qa, voces, sentir, historias)
 *   lee `prayerRequests`. Hay un test que lo vigila.
 * - Entra en "Borrar mi historial" (`history.deleteAll`) y en el borrado de
 *   cuenta (`users.purgeAccountData`).
 *
 * Gratis: no pasa por `convex/quotas.ts`. La llave es `identity.subject`, nunca
 * un userId por argumento.
 */

/** Tope de la petición y de la nota de respuesta. Mismo tope que la nota de un guardado. */
export const PRAYER_TEXT_MAX_LENGTH = 500;

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

function cleanText(value: string, field: string, required: boolean): string {
  const text = value.trim();
  if (required && text.length === 0) {
    throw new ConvexError(`${field} no puede estar vacía`);
  }
  if (text.length > PRAYER_TEXT_MAX_LENGTH) {
    throw new ConvexError(`${field} puede tener hasta ${PRAYER_TEXT_MAX_LENGTH} caracteres`);
  }
  return text;
}

async function ownPrayer(ctx: MutationCtx, id: Id<"prayerRequests">) {
  const userId = await requireUserId(ctx);
  const prayer = await ctx.db.get(id);
  // Una petición ajena se trata igual que una que no existe: no se confirma
  // que el id sea de otra persona.
  if (!prayer || prayer.userId !== userId) {
    throw new ConvexError("Petición no encontrada");
  }
  return prayer;
}

/**
 * Todas las peticiones de la persona: abiertas primero (la más nueva arriba),
 * después las respondidas (la respondida más reciente arriba).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("prayerRequests")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    // `_creationTime` desempata dos guardadas en el mismo milisegundo.
    const open = rows
      .filter((row) => row.answeredAt === undefined)
      .sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime);
    const answered = rows
      .filter((row) => row.answeredAt !== undefined)
      .sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0) || b._creationTime - a._creationTime);
    return [...open, ...answered].map((row) => ({
      id: row._id,
      text: row.text,
      createdAt: row.createdAt,
      answeredAt: row.answeredAt ?? null,
      answerNote: row.answerNote ?? null,
      verse: row.verse ?? null,
    }));
  },
});

/** Guarda una petición. Desde Sentir viaja también el versículo del devocional. */
export const create = mutation({
  args: {
    text: v.string(),
    verse: v.optional(v.object({ book: v.string(), chapter: v.number(), verse: v.number() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const text = cleanText(args.text, "La petición", true);
    return await ctx.db.insert("prayerRequests", {
      userId,
      text,
      createdAt: Date.now(),
      ...(args.verse ? { verse: args.verse } : {}),
    });
  },
});

/** Marca una petición como respondida, con una nota opcional ("¿Cómo respondió Dios?"). */
export const markAnswered = mutation({
  args: { id: v.id("prayerRequests"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const prayer = await ownPrayer(ctx, args.id);
    const note = cleanText(args.note ?? "", "La nota", false);
    await ctx.db.patch(prayer._id, { answeredAt: Date.now(), answerNote: note.length > 0 ? note : undefined });
    return null;
  },
});

/** La vuelve a abrir (por si se marcó respondida sin querer). Borra la nota. */
export const reopen = mutation({
  args: { id: v.id("prayerRequests") },
  handler: async (ctx, args) => {
    const prayer = await ownPrayer(ctx, args.id);
    await ctx.db.patch(prayer._id, { answeredAt: undefined, answerNote: undefined });
    return null;
  },
});

/** Borra la petición de verdad (no hay `deleted: true`). */
export const remove = mutation({
  args: { id: v.id("prayerRequests") },
  handler: async (ctx, args) => {
    const prayer = await ownPrayer(ctx, args.id);
    await ctx.db.delete(prayer._id);
    return null;
  },
});

/**
 * Hard delete de todas las peticiones de una persona. Única implementación:
 * la usan "Borrar mi historial" y el borrado de cuenta. `budget` acota las
 * filas por transacción, como el resto de la cascada.
 */
export async function deletePrayersForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number = Number.POSITIVE_INFINITY,
): Promise<{ deleted: number; done: boolean }> {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("prayerRequests")
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
