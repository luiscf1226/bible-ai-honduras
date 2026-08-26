import { resolveBibleVersion } from "./bibleVersions";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, query } from "./_generated/server";
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

// Un solo hilo continuo de Q&A por usuario (a diferencia de Voces, que
// tiene un hilo por personaje) — coincide con el prototipo, una sola
// pantalla de chat "Pregunta al texto".
export const thread = query({
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
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", user._id).eq("module", "qa"))
      .first();
    if (!conversation) {
      return [];
    }
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .collect();
  },
});

export const persistTurn = internalMutation({
  args: {
    userText: v.string(),
    assistantText: v.string(),
    citation: v.optional(citationArg),
  },
  handler: async (ctx, args): Promise<Id<"conversations">> => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", user._id).eq("module", "qa"))
      .first();
    const conversationId = existing
      ? existing._id
      : await ctx.db.insert("conversations", { userId: user._id, module: "qa", createdAt: Date.now() });

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
  | { status: "limit_reached"; answer: null; citation: null }
  | { status: "ok"; answer: string; citation: Citation | null };

// Pregunta libre o con pasaje explícito. `passage` solo lleva book/chapter
// para no forzar un versículo puntual (el selector, #12, permite avanzar
// sin elegir uno) — en ese caso se agrega como contexto a la pregunta en
// vez de forzar un `passage` exacto en rag.answer.ask.
export const ask = action({
  args: {
    question: v.string(),
    passage: v.optional(
      v.object({
        book: v.string(),
        chapter: v.number(),
        verse: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<AskResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("No autenticado");
    }
    await ctx.runQuery(api.users.requireAiConsent, {});

    const quota = await ctx.runMutation(api.quotas.checkAndConsume, { module: "qa" });
    if (!quota.allowed) {
      return { status: "limit_reached", answer: null, citation: null };
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

    await ctx.runMutation(internal.qa.persistTurn, {
      userText: args.question,
      assistantText: result.answer,
      citation: result.citation ?? undefined,
    });

    return { status: "ok", answer: result.answer, citation: result.citation };
  },
});
