import { ConvexError, v } from "convex/values";

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

// Hard delete: borra messages y después conversations del usuario actual.
// No escribe `deleted: true`. Lo que no es tuyo no se toca.
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", user._id))
      .collect();

    let deletedMessages = 0;
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
        deletedMessages += 1;
      }
      await ctx.db.delete(conversation._id);
    }

    return {
      deletedConversations: conversations.length,
      deletedMessages,
    };
  },
});
