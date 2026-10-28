import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveBibleVersion } from "./bibleVersions";
import { feedReel, isReelRef, rankReels, REEL_POOL, type FeedReel, type FeedReelKind } from "./feedReelsCore";
import { feedAudioUrl, feedImageUrl, REEL_AUDIO_VERSION } from "./verseFeedMedia";
import { feedPassageText, spokenText, textHash } from "./verseFeedText";
import { FEED_PAGE_SIZE, FEED_POOL, FEED_SEEN_MAX, FEED_TOPIC_NAMES, feedPassage, rankFeedPage } from "./verseFeedCore";
import { FEED_REEL_SLOTS } from "./verseFeedLimits";

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos). El orden y el
 * catálogo viven en `verseFeedCore.ts`; acá solo se leen los ♥ y el texto.
 */

/** Cuántas citas de la comunidad entran al puntaje: las más queridas. */
const COMMUNITY_TOP = 60;
/** Cuántos ♥ propios cuentan para la afinidad: los más recientes. */
const LIKES_FOR_AFFINITY = 200;

export type FeedItem = {
  kind: "verse";
  /** Id de la cita en el catálogo (lo que guarda el ♥). Para mostrar, la cita sale de book/chapter/verse/endVerse. */
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  endVerse: number | null;
  text: string;
  version: string;
  /** Nombre del tema ("Esperanza"), o null si la cita solo viene de un devocional. */
  topic: string | null;
  /** Fondo de IA de la cita; mientras no exista, la foto del devocional. */
  imageUrl: string;
  imageAlt: string;
  /** Lectura en voz natural del texto que se muestra, o null si todavía no se generó. */
  audioUrl: string | null;
  likes: number;
  liked: boolean;
};

/** Una escena de un reel, lista para mostrar: su texto, su cita, su fondo y su voz. */
export type FeedReelSceneItem = {
  text: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number | null;
  imageUrl: string;
  imageAlt: string;
  /** Voz de la escena, o null si todavía no se generó (la escena avanza con el tiempo de lectura). */
  audioUrl: string | null;
};

/** Historia contada o personaje en 1ra persona (design/oleada-ux.md §Reels del feed). */
export type FeedReelItem = {
  kind: FeedReelKind;
  ref: string;
  title: string;
  subtitle: string;
  voiceSlug: string | null;
  scenes: FeedReelSceneItem[];
  likes: number;
  liked: boolean;
};

export type FeedEntry = FeedItem | FeedReelItem;

async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function likesFor(ctx: QueryCtx, ref: string): Promise<number> {
  const stats = await ctx.db
    .query("verseFeedStats")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
  return stats?.likes ?? 0;
}

async function hasLiked(ctx: QueryCtx, userId: Id<"users">, ref: string): Promise<boolean> {
  const row = await ctx.db
    .query("verseFeedLikes")
    .withIndex("by_user_ref", (q) => q.eq("userId", userId).eq("ref", ref))
    .unique();
  return row !== null;
}

export type FeedPage = {
  items: FeedEntry[];
  /**
   * Ya se había visto todo el catálogo y esta página empieza otra vuelta: el
   * cliente reinicia su lista de vistos (dejando las últimas, para no repetirlas).
   */
  newRound: boolean;
  /**
   * Citas que tocaban pero no están en la Biblia cargada. El cliente las suma
   * a lo visto para que no se vuelvan a pedir: si no, el final de una vuelta
   * podría quedarse devolviendo páginas vacías.
   */
  skipped: string[];
};

async function reelItem(ctx: QueryCtx, reel: FeedReel, likes: number, liked: boolean): Promise<FeedReelItem> {
  const scenes: FeedReelSceneItem[] = [];
  for (const [index, scene] of reel.scenes.entries()) {
    const aiImage = await feedImageUrl(ctx, scene.mediaRef);
    scenes.push({
      text: scene.text,
      reference: scene.reference,
      book: scene.book,
      chapter: scene.chapter,
      verse: scene.verse,
      ...(aiImage
        ? { imageUrl: aiImage, imageAlt: `Ilustración de ${reel.title}, parte ${index + 1}` }
        : { imageUrl: reel.fallbackImageUrl, imageAlt: reel.fallbackImageAlt }),
      // Solo si la voz guardada leyó exactamente este texto (el catálogo puede corregirse).
      audioUrl: await feedAudioUrl(ctx, scene.mediaRef, REEL_AUDIO_VERSION, textHash(scene.text)),
    });
  }
  return {
    kind: reel.kind,
    ref: reel.ref,
    title: reel.title,
    subtitle: reel.subtitle,
    voiceSlug: reel.voiceSlug,
    scenes,
    likes,
    liked,
  };
}

/**
 * La próxima página del feed. El cliente manda lo que ya vio en esta vuelta y
 * una semilla por sesión: así cada página es una consulta determinística y el
 * feed no se repite. Sin sesión también anda, solo que sin ♥ propios.
 *
 * Con `withReels`, dos de cada ocho lugares son historias contadas o
 * personajes (`FEED_REEL_SLOTS`). Sin eso —las versiones de la app que ya
 * están en la tienda— la página es solo de versículos, como siempre.
 */
export const page = query({
  args: { seen: v.array(v.string()), seed: v.number(), withReels: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<FeedPage> => {
    const seenRefs = args.seen.slice(-FEED_SEEN_MAX);
    const user = await currentUser(ctx);
    const likedRows = user
      ? await ctx.db
          .query("verseFeedLikes")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(LIKES_FOR_AFFINITY + REEL_POOL.length)
      : [];
    // Los ♥ de reels y de versículos se ordenan por separado: un reel muy querido no le quita
    // lugar a los versículos de la comunidad ni achica su escala (y al revés).
    const likedRefs = likedRows
      .map((row) => row.ref)
      .filter((ref) => !isReelRef(ref))
      .slice(0, LIKES_FOR_AFFINITY);
    const likedReelRefs = likedRows.map((row) => row.ref).filter(isReelRef);
    const top = await ctx.db
      .query("verseFeedStats")
      .withIndex("by_likes")
      .order("desc")
      .take(COMMUNITY_TOP + REEL_POOL.length);
    const communityLikes = new Map(
      top
        .filter((row) => !isReelRef(row.ref))
        .slice(0, COMMUNITY_TOP)
        .map((row) => [row.ref, row.likes]),
    );
    const reelLikes = new Map(top.filter((row) => isReelRef(row.ref)).map((row) => [row.ref, row.likes]));

    // Se ordenan de más por si alguna cita no está en la Biblia cargada: la página igual sale llena.
    const { newRound, passages } = rankFeedPage({
      communityLikes,
      likedRefs,
      pool: FEED_POOL,
      seed: args.seed,
      seenRefs,
      size: FEED_PAGE_SIZE * 2,
    });
    // #93 §4b: una preferencia sin corpus (NVI) degrada a RVR1960.
    const version = resolveBibleVersion(user?.bibleVersion);
    const reelSlots = args.withReels ? FEED_REEL_SLOTS.filter((slot) => slot < FEED_PAGE_SIZE) : [];
    const verseCount = FEED_PAGE_SIZE - reelSlots.length;
    const items: FeedItem[] = [];
    const skipped: string[] = [];
    for (const passage of passages) {
      if (items.length === verseCount) break;
      const fitted = await feedPassageText(ctx, passage, version);
      // Una cita que no está en la Biblia cargada (o no entra en la pantalla) no se muestra:
      // nunca texto inventado ni cortado (regla dura #4).
      if (!fitted) {
        skipped.push(passage.ref);
        continue;
      }
      const topicId = passage.topics[0];
      const aiImage = await feedImageUrl(ctx, passage.ref);
      const reference =
        fitted.endVerse === null
          ? `${passage.book} ${passage.chapter}:${passage.verse}`
          : `${passage.book} ${passage.chapter}:${passage.verse}-${fitted.endVerse}`;
      items.push({
        kind: "verse",
        ref: passage.ref,
        book: passage.book,
        chapter: passage.chapter,
        verse: passage.verse,
        endVerse: fitted.endVerse,
        text: fitted.text,
        version,
        topic: topicId ? (FEED_TOPIC_NAMES.get(topicId) ?? null) : null,
        ...(aiImage
          ? { imageUrl: aiImage, imageAlt: `Ilustración inspirada en ${reference}` }
          : { imageUrl: passage.imageUrl, imageAlt: passage.imageAlt }),
        // Solo si la voz guardada leyó exactamente este texto.
        audioUrl: await feedAudioUrl(ctx, passage.ref, version, textHash(spokenText(fitted.text))),
        likes: communityLikes.get(passage.ref) ?? (await likesFor(ctx, passage.ref)),
        // Lectura puntual: la afinidad mira los últimos ♥, pero el corazón tiene que estar bien siempre.
        liked: user ? await hasLiked(ctx, user._id, passage.ref) : false,
      });
    }
    if (reelSlots.length === 0 || items.length === 0) return { items, newRound, skipped };

    const reels = rankReels({
      communityLikes: reelLikes,
      count: reelSlots.length,
      likedRefs: likedReelRefs,
      pool: REEL_POOL,
      seed: args.seed + seenRefs.length,
      seenRefs,
    });
    const entries: FeedEntry[] = [...items];
    for (const [index, reel] of reels.entries()) {
      const item = await reelItem(
        ctx,
        reel,
        reelLikes.get(reel.ref) ?? (await likesFor(ctx, reel.ref)),
        user ? await hasLiked(ctx, user._id, reel.ref) : false,
      );
      // Si faltaron versículos, el reel va igual, sin dejar huecos.
      entries.splice(Math.min(reelSlots[index], entries.length), 0, item);
    }
    return { items: entries, newRound, skipped };
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

/**
 * Deja el ♥ como la persona lo pidió (idempotente: repetirlo no cambia nada).
 * Así un toque que llega tarde o un reintento nunca invierte lo que se quiso.
 * Vale para versículos y para reels (historias y personajes).
 */
export const setLike = mutation({
  args: { ref: v.string(), liked: v.boolean() },
  handler: async (ctx, args): Promise<{ liked: boolean; likes: number }> => {
    const user = await currentUser(ctx);
    if (!user) throw new ConvexError("No autenticado");
    // Solo citas y reels del catálogo: nadie puede inflar algo inventado.
    if (!feedPassage(args.ref) && !feedReel(args.ref)) throw new ConvexError("Versículo desconocido");

    const existing = await ctx.db
      .query("verseFeedLikes")
      .withIndex("by_user_ref", (q) => q.eq("userId", user._id).eq("ref", args.ref))
      .unique();
    if (args.liked && !existing) {
      await ctx.db.insert("verseFeedLikes", {
        userId: user._id,
        ref: args.ref,
        createdAt: Date.now(),
      });
      return { liked: true, likes: await adjustStats(ctx, args.ref, 1) };
    }
    if (!args.liked && existing) {
      await ctx.db.delete(existing._id);
      return { liked: false, likes: await adjustStats(ctx, args.ref, -1) };
    }
    return { liked: args.liked, likes: await likesFor(ctx, args.ref) };
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
