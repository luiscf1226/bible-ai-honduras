import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { voiceCharacters } from "./voicesCatalog";

type AuthedCtx = QueryCtx | MutationCtx;

async function findByClerkId(ctx: AuthedCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

async function requireUser(ctx: AuthedCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("No autenticado");
  }
  const user = await findByClerkId(ctx, identity.subject);
  if (!user) {
    throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
  }
  return user;
}

function titleFor(module: "qa" | "voices" | "feelings", characterId?: string) {
  if (module === "voices") {
    const character = voiceCharacters.find((item) => item.slug === characterId);
    return character?.name ?? "Voces";
  }
  if (module === "feelings") {
    return "Sentimiento";
  }
  return "Pregunta al texto";
}

function initialFor(title: string) {
  return title[0]?.toUpperCase() ?? "?";
}

// Conversaciones del usuario autenticado, más recientes primero.
// Preview = último mensaje. No incluye filas de otros usuarios.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await findByClerkId(ctx, identity.subject);
    if (!user) {
      return [];
    }

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", user._id))
      .collect();

    const items = await Promise.all(
      conversations.map(async (conversation) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .collect();
        const last = messages[messages.length - 1];
        const title = titleFor(conversation.module, conversation.characterId);
        return {
          id: conversation._id,
          module: conversation.module,
          characterId: conversation.characterId,
          createdAt: conversation.createdAt,
          title,
          initial: initialFor(title),
          preview: last?.text ?? "",
        };
      }),
    );

    return items.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Detalle de una conversación propia. El historial de Sentimiento guarda su
// estructura de devocional en el último mensaje asistente, sin crear otra
// colección ni otra ruta de privacidad.
export const getById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      return null;
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .collect();
    return { ...conversation, messages };
  },
});

// Cuántos mensajes se leen por página. No es un límite de producto: es para no
// traer a memoria una conversación enorme de una sola vez.
const MESSAGE_PAGE = 128;

/**
 * Hard delete de `messages` + `conversations` de un usuario. Única
 * implementación del borrado de historial: la usa `history.deleteAll` (#35) y
 * también `users.deleteAccount` (#107), que no puede duplicar esta lógica.
 *
 * `budget` es el máximo de filas a borrar en esta transacción. Si se agota,
 * devuelve `done: false` y el llamador vuelve a invocar hasta que sea `true`
 * — así una cuenta con miles de mensajes no revienta el límite de escrituras
 * de una mutación. Los mensajes de una conversación se borran *antes* que la
 * conversación, así que un corte a mitad nunca deja mensajes huérfanos.
 */
export async function deleteConversationsForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number = Number.POSITIVE_INFINITY,
): Promise<{ deletedConversations: number; deletedMessages: number; done: boolean }> {
  let deletedConversations = 0;
  let deletedMessages = 0;
  let spent = 0;

  const nextConversation = () =>
    ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", userId))
      .first();

  while (spent < budget) {
    const conversation = await nextConversation();
    if (!conversation) {
      return { deletedConversations, deletedMessages, done: true };
    }

    const messagesOf = (limit: number) =>
      ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .take(limit);

    while (spent < budget) {
      const page = await messagesOf(Math.min(MESSAGE_PAGE, budget - spent));
      if (page.length === 0) {
        break;
      }
      for (const message of page) {
        await ctx.db.delete(message._id);
        deletedMessages += 1;
        spent += 1;
      }
    }

    // Si el presupuesto se acabó con mensajes todavía colgando, la conversación
    // se queda para la próxima pasada: nunca se borra el padre antes que el hijo.
    const pending = await messagesOf(1);
    if (pending.length > 0) {
      return { deletedConversations, deletedMessages, done: false };
    }

    await ctx.db.delete(conversation._id);
    deletedConversations += 1;
    spent += 1;
  }

  return {
    deletedConversations,
    deletedMessages,
    done: (await nextConversation()) === null,
  };
}

// Hard delete: borra messages y después conversations del usuario actual.
// No escribe `deleted: true`. Lo que no es tuyo no se toca.
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const { deletedConversations, deletedMessages } = await deleteConversationsForUser(ctx, user._id);
    return { deletedConversations, deletedMessages };
  },
});
