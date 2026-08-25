import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, query } from "./_generated/server";
import { isGrounded } from "./rag/answer";
import { generateStructuredAnswer } from "./rag/llm";
import { retrieveTopVerses } from "./rag/retrieve";
import { voiceCharacters } from "./voicesCatalog";
import {
  DIVINE_REFUSAL,
  assertVoiceTurn,
  assistantSpeaksAsDivine,
} from "./voicesGuardrail";
import {
  buildVoicesSystemPrompt,
  buildVoicesUserPrompt,
  formatVoiceCitation,
  VOICE_RESPONSE_SCHEMA,
  voicesNoContextReply,
} from "./voicesPrompt";

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

function characterBySlug(slug: string) {
  return voiceCharacters.find((character) => character.slug === slug) ?? null;
}

export const list = query({
  args: {},
  handler: async () => voiceCharacters,
});

export const thread = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
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
      .withIndex("by_user_module", (q) => q.eq("userId", user._id).eq("module", "voices"))
      .collect();
    const conversation = conversations.find((row) => row.characterId === args.slug);
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
    slug: v.string(),
    userText: v.string(),
    assistantText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user_module", (q) => q.eq("userId", user._id).eq("module", "voices"))
      .collect();
    let conversationId: Id<"conversations">;
    const existing = conversations.find((row) => row.characterId === args.slug);
    if (existing) {
      conversationId = existing._id;
    } else {
      conversationId = await ctx.db.insert("conversations", {
        userId: user._id,
        module: "voices",
        characterId: args.slug,
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      text: args.userText,
    });
    await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      text: args.assistantText,
    });
    return conversationId;
  },
});

export const sendMessage = action({
  args: {
    slug: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("No autenticado");
    }

    const character = characterBySlug(args.slug);
    const verdict = assertVoiceTurn({ slug: args.slug, userText: args.text });
    if (!character || !verdict.ok) {
      const refusal = !verdict.ok ? verdict.refusal : DIVINE_REFUSAL;
      return { status: "refused" as const, answer: refusal, citation: null };
    }

    const quota = await ctx.runMutation(api.quotas.checkAndConsume, { module: "voices" });
    if (!quota.allowed) {
      return { status: "limit_reached" as const, answer: null, citation: null };
    }

    const user = await ctx.runQuery(api.users.current, {});
    const version = user?.bibleVersion ?? "RVR1960";
    const verses = await retrieveTopVerses(ctx, {
      query: `${character.name}: ${args.text}`,
      version,
    });

    if (verses.length === 0) {
      const answer = voicesNoContextReply(character);
      await ctx.runMutation(internal.voices.persistTurn, {
        slug: args.slug,
        userText: args.text,
        assistantText: answer,
      });
      return { status: "ok" as const, answer, citation: null };
    }

    const primary = verses[0];
    const structured = await generateStructuredAnswer({
      system: buildVoicesSystemPrompt(character),
      userPrompt: buildVoicesUserPrompt(character, args.text, verses),
      schema: VOICE_RESPONSE_SCHEMA,
    });
    // Si el modelo cita algo fuera del contexto recuperado, esa prosa nunca
    // llega al usuario (regla dura #4) — cae a una respuesta segura anclada
    // solo en el texto realmente recuperado.
    let answer = isGrounded(structured, verses)
      ? structured.answer
      : `"${primary.text}"\n\n${formatVoiceCitation(primary)}`;
    if (assistantSpeaksAsDivine(answer)) {
      answer = DIVINE_REFUSAL;
    }

    const citationLine = formatVoiceCitation(primary);
    const stored = `${answer}\n\n— ${citationLine}`;
    await ctx.runMutation(internal.voices.persistTurn, {
      slug: args.slug,
      userText: args.text,
      assistantText: stored,
    });

    return {
      status: "ok" as const,
      answer: stored,
      citation: {
        book: primary.book,
        chapter: primary.chapter,
        verse: primary.verse,
        version: primary.version,
        text: primary.text,
      },
    };
  },
});
