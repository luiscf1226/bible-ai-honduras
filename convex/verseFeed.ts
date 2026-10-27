import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { bibleVersionForIdentity } from "./rag/verses";
import {
  FEED_PAGE_SIZE,
  FEED_POOL,
  FEED_SEEN_MAX,
  FEED_TOPIC_NAMES,
  feedPassage,
  rankFeedPage,
  type FeedPassage,
} from "./verseFeedCore";

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos). El orden y el
 * catálogo viven en `verseFeedCore.ts`; acá solo se leen los ♥ y el texto.
 */

/** Cuántas citas de la comunidad entran al puntaje: las más queridas. */
const COMMUNITY_TOP = 60;
/** Cuántos ♥ propios cuentan para la afinidad: los más recientes. */
const LIKES_FOR_AFFINITY = 200;

export type FeedItem = {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  endVerse: number | null;
  text: string;
  version: string;
  /** Nombre del tema ("Esperanza"), o null si la cita solo viene de un devocional. */
  topic: string | null;
  imageUrl: string;
  imageAlt: string;
  likes: number;
  liked: boolean;
};

async function currentUserId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

async function passageText(ctx: QueryCtx, passage: FeedPassage, version: string): Promise<string | null> {
  const last = passage.endVerse ?? passage.verse;
  const rows = await ctx.db
    .query("verses")
    .withIndex("by_ref", (q) =>
      q
        .eq("version", version)
        .eq("book", passage.book)
        .eq("chapter", passage.chapter)
        .gte("verse", passage.verse)
        .lte("verse", last),
    )
    .collect();
  if (rows.length === 0) return null;
  return rows.map((row) => row.text.trim()).join(" ");
}

async function likesFor(ctx: QueryCtx, ref: string): Promise<number> {
  const stats = await ctx.db
    .query("verseFeedStats")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  return stats?.likes ?? 0;
}

/**
 * La próxima página del feed. El cliente manda lo que ya vio (las últimas
 * `FEED_SEEN_MAX` citas) y una semilla por sesión: así cada página es una
 * consulta determinística y el feed no se repite. Sin sesión también anda,
 * solo que sin ♥ propios.
 */
export const page = query({
  args: { seen: v.array(v.string()), seed: v.number() },
  handler: async (ctx, args): Promise<FeedItem[]> => {
    const seenRefs = args.seen.slice(-FEED_SEEN_MAX);
    const userId = await currentUserId(ctx);
    const likedRows = userId
      ? await ctx.db
          .query("verseFeedLikes")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(LIKES_FOR_AFFINITY)
      : [];
    const likedRefs = likedRows.map((row) => row.ref);
    const top = await ctx.db.query("verseFeedStats").withIndex("by_likes").order("desc").take(COMMUNITY_TOP);
    const communityLikes = new Map(top.map((row) => [row.ref, row.likes]));

    const passages = rankFeedPage({ communityLikes, likedRefs, pool: FEED_POOL, seed: args.seed, seenRefs });
    const version = await bibleVersionForIdentity(ctx);
    const liked = new Set(likedRefs);

    const items: FeedItem[] = [];
    for (const passage of passages) {
      const text = await passageText(ctx, passage, version);
      // Una cita que no está en la Biblia cargada no se muestra: nunca texto inventado (regla dura #4).
      if (!text) continue;
      const topicId = passage.topics[0];
      items.push({
        ref: passage.ref,
        book: passage.book,
        chapter: passage.chapter,
        verse: passage.verse,
        endVerse: passage.endVerse,
        text,
        version,
        topic: topicId ? (FEED_TOPIC_NAMES.get(topicId) ?? null) : null,
        imageUrl: passage.imageUrl,
        imageAlt: passage.imageAlt,
        likes: communityLikes.get(passage.ref) ?? (await likesFor(ctx, passage.ref)),
        liked: liked.has(passage.ref),
      });
    }
    return items.slice(0, FEED_PAGE_SIZE);
  },
});

async function adjustStats(ctx: MutationCtx, ref: string, delta: number): Promise<number> {
  const stats = await ctx.db
    .query("verseFeedStats")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  const likes = Math.max(0, (stats?.likes ?? 0) + delta);
  // Sin ♥, la cita no tiene fila: la tabla solo guarda lo que alguien quiere.
  if (stats && likes === 0) await ctx.db.delete(stats._id);
  else if (stats) await ctx.db.patch(stats._id, { likes });
  else if (likes > 0) await ctx.db.insert("verseFeedStats", { ref, likes });
  return likes;
}

/** ♥ / quitar ♥. Solo citas del catálogo: nadie puede inflar una cita inventada. */
export const toggleLike = mutation({
  args: { ref: v.string() },
  handler: async (ctx, args): Promise<{ liked: boolean; likes: number }> => {
    const userId = await currentUserId(ctx);
    if (!userId) throw new ConvexError("No autenticado");
    if (!feedPassage(args.ref)) throw new ConvexError("Versículo desconocido");

    const existing = await ctx.db
      .query("verseFeedLikes")
      .withIndex("by_user_ref", (q) => q.eq("userId", userId).eq("ref", args.ref))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { liked: false, likes: await adjustStats(ctx, args.ref, -1) };
    }
    await ctx.db.insert("verseFeedLikes", { userId, ref: args.ref, createdAt: Date.now() });
    return { liked: true, likes: await adjustStats(ctx, args.ref, 1) };
  },
});

/** Borrado de cuenta: los ♥ de la persona, y se descuentan del total de la comunidad. */
export async function deleteVerseFeedLikesForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: number; done: boolean }> {
  const rowsOf = (limit: number) =>
    ctx.db
      .query("verseFeedLikes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(limit);
  let deleted = 0;
  while (deleted < budget) {
    const rows = await rowsOf(Math.min(budget - deleted, 128));
    if (rows.length === 0) return { deleted, done: true };
    for (const row of rows) {
      await ctx.db.delete(row._id);
      await adjustStats(ctx, row.ref, -1);
      deleted += 1;
    }
  }
  return { deleted, done: (await rowsOf(1)).length === 0 };
}
