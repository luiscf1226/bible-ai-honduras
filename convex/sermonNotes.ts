import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { cleanSermonNote } from "./sermonNotesCore";

/**
 * Notas de prédica (#232, Parte 2). La persona anota la prédica del culto y
 * la nota queda **anclada a los pasajes**: cada pasaje abre el lector.
 *
 * Reglas (las mismas que el diario de oración, #159):
 * - **Sin IA** (regla dura #4): es texto de la persona. Ningún prompt (qa,
 *   voces, sentir, historias, rag) lee `sermonNotes`; hay un test que lo vigila.
 *   Lo único "automático" es que la cita apunte al texto RV1909 del lector.
 * - Privadas: no se publican; compartir es una decisión de la persona y sale
 *   por `src/lib/share.ts` (regla dura #3).
 * - Gratis: no pasa por `convex/quotas.ts`.
 * - Entran en "Borrar mi historial" (`history.deleteAll`) y en el borrado de
 *   cuenta (`users.purgeAccountData`).
 *
 * Sin conexión (en el templo la señal es mala): el teléfono le pone a cada nota
 * un `clientId` y la manda por la cola (`src/features/offline/mutationQueue.ts`).
 * `save` es un upsert por `clientId`: reenviarla después de un corte la
 * actualiza, nunca la duplica. La llave es `identity.subject`, nunca un userId
 * por argumento.
 */

export { SERMON_NOTE_LIMITS, cleanSermonNote } from "./sermonNotesCore";
export type { SermonNoteInput, SermonPassage } from "./sermonNotesCore";

export const sermonPassage = v.object({
  book: v.string(),
  chapter: v.number(),
  verse: v.optional(v.number()),
});

export const sermonNoteFields = {
  clientId: v.string(),
  /** Día del culto, `YYYY-MM-DD` (por defecto hoy en el teléfono). */
  date: v.string(),
  church: v.optional(v.string()),
  preacher: v.optional(v.string()),
  title: v.string(),
  passages: v.array(sermonPassage),
  notes: v.string(),
  /** "¿Qué me llevo?": una línea. */
  takeaway: v.string(),
};

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

function toClient(row: Doc<"sermonNotes">) {
  return {
    id: row._id,
    clientId: row.clientId,
    date: row.date,
    church: row.church ?? "",
    preacher: row.preacher ?? "",
    title: row.title,
    passages: row.passages,
    notes: row.notes,
    takeaway: row.takeaway,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type SermonNoteRow = ReturnType<typeof toClient>;

/** Todas las notas de la persona, de la más reciente a la más vieja (fecha del culto, después edición). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      return [];
    }
    const rows = await ctx.db
      .query("sermonNotes")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt || b._creationTime - a._creationTime)
      .map(toClient);
  },
});

/**
 * Crea o actualiza la nota con ese `clientId` (upsert). Devuelve si fue nueva,
 * para que el teléfono cuente `sermon_note_created` una sola vez.
 */
export const save = mutation({
  args: sermonNoteFields,
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const note = cleanSermonNote(args);
    const now = Date.now();
    const existing = await ctx.db
      .query("sermonNotes")
      .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", note.clientId))
      .unique();
    const fields = {
      date: note.date,
      church: note.church.length > 0 ? note.church : undefined,
      preacher: note.preacher.length > 0 ? note.preacher : undefined,
      title: note.title,
      passages: note.passages,
      notes: note.notes,
      takeaway: note.takeaway,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return { id: existing._id, created: false };
    }
    const id = await ctx.db.insert("sermonNotes", { userId, clientId: note.clientId, createdAt: now, ...fields });
    return { id, created: true };
  },
});

/** Borra la nota de verdad. Si ya no existe (se borró en otro teléfono), no es error. */
export const remove = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("sermonNotes")
      .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", args.clientId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

/**
 * Hard delete de todas las notas de una persona. Única implementación: la
 * usan "Borrar mi historial" y el borrado de cuenta. `budget` acota las filas
 * por transacción, como el resto de la cascada.
 */
export async function deleteSermonNotesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number = Number.POSITIVE_INFINITY,
): Promise<{ deleted: number; done: boolean }> {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("sermonNotes")
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
