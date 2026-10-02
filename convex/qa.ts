import { resolveBibleVersion } from "./bibleVersions";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import type { Citation } from "./rag/answer";

const citationArg = v.object({
  verseId: v.id("verses"),
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
  version: v.string(),
  text: v.string(),
});

async function findByClerkId(ctx: QueryCtx | MutationCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

async function requireUser(ctx: QueryCtx | MutationCtx) {
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

const passageArg = v.object({
  book: v.string(),
  chapter: v.number(),
  verse: v.optional(v.number()),
});

type Passage = { book: string; chapter: number; verse?: number };

// La conversación única de antes de #191 no tiene título: se resuelve al leer
// en vez de migrar filas.
export const LEGACY_CONVERSATION_TITLE = "Conversación anterior";
const TITLE_MAX = 40;
const CONVERSATIONS_DEFAULT_LIMIT = 20;
const CONVERSATIONS_MAX_LIMIT = 50;

// Título de una conversación nueva: el pasaje si vino ("Juan 3", "Juan 3:16"),
// o el inicio de la pregunta libre cortado en una palabra.
export function conversationTitle(question: string, passage?: Passage): string {
  if (passage) {
    return `${passage.book} ${passage.chapter}${passage.verse === undefined ? "" : `:${passage.verse}`}`;
  }
  const clean = question.trim().replace(/\s+/g, " ");
  if (clean.length <= TITLE_MAX) {
    return clean;
  }
  const cut = clean.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

// Conversación de Preguntar del usuario, o null si no existe, es de otro o es
// de otro módulo. Nunca distingue entre "no existe" y "no es tuya".
async function ownedQaConversation(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== userId || conversation.module !== "qa") {
    return null;
  }
  return conversation;
}

async function mostRecentQaConversation(ctx: QueryCtx, userId: Id<"users">) {
  // Las filas sin `updatedAt` (la conversación única de antes) quedan al final.
  return ctx.db
    .query("conversations")
    .withIndex("by_user_module_updated", (q) => q.eq("userId", userId).eq("module", "qa"))
    .order("desc")
    .first();
}

// Mensajes de una conversación de Preguntar (#191: una por tema). Sin
// `conversationId` devuelve la más reciente, para que los builds anteriores a
// #191 sigan mostrando algo hasta el bump de MIN_*_BUILD.
export const thread = query({
  args: { conversationId: v.optional(v.id("conversations")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await findByClerkId(ctx, identity.subject);
    if (!user) {
      return [];
    }
    const conversation = args.conversationId
      ? await ownedQaConversation(ctx, user._id, args.conversationId)
      : await mostRecentQaConversation(ctx, user._id);
    if (!conversation) {
      return [];
    }
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .collect();
  },
});

// Conversaciones de Preguntar del usuario, más reciente primero (cajón de U6).
export const conversations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await findByClerkId(ctx, identity.subject);
    if (!user) {
      return [];
    }
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? CONVERSATIONS_DEFAULT_LIMIT), 1),
      CONVERSATIONS_MAX_LIMIT,
    );
    const rows = await ctx.db
      .query("conversations")
      .withIndex("by_user_module_updated", (q) => q.eq("userId", user._id).eq("module", "qa"))
      .order("desc")
      .take(limit);

    return Promise.all(
      rows.map(async (conversation) => {
        // El último turno es pregunta + respuesta: la pregunta está entre los dos últimos.
        const tail = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
          .order("desc")
          .take(2);
        return {
          _id: conversation._id,
          title: conversation.title ?? LEGACY_CONVERSATION_TITLE,
          passage: conversation.passage ?? null,
          updatedAt: conversation.updatedAt ?? conversation.createdAt,
          lastQuestion: tail.find((message) => message.role === "user")?.text ?? null,
        };
      }),
    );
  },
});

// Chequeo de dueño antes de gastar cuota o llamar al RAG.
export const assertOwnedConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(await ownedQaConversation(ctx, user._id, args.conversationId))) {
      throw new ConvexError("Conversación no encontrada");
    }
    return null;
  },
});

export const persistTurn = internalMutation({
  args: {
    conversationId: v.optional(v.id("conversations")),
    passage: v.optional(passageArg),
    userText: v.string(),
    assistantText: v.string(),
    citation: v.optional(citationArg),
  },
  handler: async (ctx, args): Promise<Id<"conversations">> => {
    const user = await requireUser(ctx);
    const now = Date.now();
    let conversationId: Id<"conversations">;
    if (args.conversationId) {
      if (!(await ownedQaConversation(ctx, user._id, args.conversationId))) {
        throw new ConvexError("Conversación no encontrada");
      }
      conversationId = args.conversationId;
      await ctx.db.patch(conversationId, { updatedAt: now });
    } else {
      conversationId = await ctx.db.insert("conversations", {
        userId: user._id,
        module: "qa",
        createdAt: now,
        updatedAt: now,
        title: conversationTitle(args.userText, args.passage),
        passage: args.passage,
      });
    }

    await ctx.db.insert("messages", { conversationId, role: "user", text: args.userText });
    await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      text: args.assistantText,
      citations: args.citation ? [args.citation] : undefined,
    });
    return conversationId;
  },
});

type AskResult =
  | { status: "limit_reached"; answer: null; citation: null; conversationId: Id<"conversations"> | null }
  | { status: "ok"; answer: string; citation: Citation | null; conversationId: Id<"conversations"> };

// Pregunta libre o con pasaje explícito. `passage` solo lleva book/chapter
// para no forzar un versículo puntual (el selector, #12, permite avanzar
// sin elegir uno) — en ese caso se agrega como contexto a la pregunta en
// vez de forzar un `passage` exacto en rag.answer.ask.
//
// #191: sin `conversationId` abre una conversación nueva (un tema = un hilo) y
// la devuelve; con `conversationId` continúa esa, si es del usuario.
export const ask = action({
  args: {
    question: v.string(),
    passage: v.optional(passageArg),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args): Promise<AskResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("No autenticado");
    }
    await ctx.runQuery(api.users.requireAiConsent, {});
    if (args.conversationId) {
      await ctx.runQuery(internal.qa.assertOwnedConversation, { conversationId: args.conversationId });
    }

    const quota = await ctx.runMutation(api.quotas.checkAndConsume, { module: "qa" });
    if (!quota.allowed) {
      return { status: "limit_reached", answer: null, citation: null, conversationId: args.conversationId ?? null };
    }

    const user = await ctx.runQuery(api.users.current, {});
    // #93 §4b: NVI no tiene corpus; resolveBibleVersion degrada a RVR1960.
    const version = resolveBibleVersion(user?.bibleVersion);

    const question =
      args.passage && args.passage.verse === undefined
        ? `Sobre ${args.passage.book} ${args.passage.chapter}: ${args.question}`
        : args.question;
    const passage =
      args.passage && args.passage.verse !== undefined
        ? { version, book: args.passage.book, chapter: args.passage.chapter, verse: args.passage.verse }
        : undefined;

    const result = await ctx.runAction(internal.rag.answer.ask, { question, passage, version });

    const conversationId = await ctx.runMutation(internal.qa.persistTurn, {
      conversationId: args.conversationId,
      passage: args.passage,
      userText: args.question,
      assistantText: result.answer,
      citation: result.citation ?? undefined,
    });

    return { status: "ok", answer: result.answer, citation: result.citation, conversationId };
  },
});
