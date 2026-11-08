import { v } from "convex/values";

import { feedVerseText } from "../src/features/feed/feedLogic";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { action, internalMutation, query } from "./_generated/server";
import { AiCallError } from "./adminKit/meter";
import { aiMeter } from "./aiUsage";
import { DEFAULT_BIBLE_VERSION } from "./bibleVersions";
import { generateFeedImage } from "./images";
import { consume, refund } from "./quotas";
import { bibleVersionForIdentity } from "./rag/verses";
import { fitPassageText } from "./verseFeedCore";
import { feedImagePrompt, feedImageUrl } from "./verseFeedMedia";
import {
  clampEndVerse,
  feedRefsCovering,
  photosFor,
  topicsFor,
  verseImageRef,
  type VerseImagePassage,
  type VerseImagePhoto,
} from "./verseImageCore";

/**
 * "Crear imagen" de cualquier versículo (design/oleada-ux.md §Crear imagen).
 * El texto sale del corpus en la versión de la persona, tal cual (regla dura
 * #4). El fondo con IA es el mismo del feed (`verseFeedMedia`, mismo prompt,
 * misma llave): lo que una persona genera acá también lo ve el feed, y lo que
 * el feed ya tiene no se vuelve a pagar. Cada fondo nuevo pasa por la cuota
 * `verseImage` (regla dura #3).
 */

/** Lo que dura la reserva de un fondo mientras se genera (una imagen tarda ~20 s, el tope es 2 min). */
const RESERVATION_MS = 3 * 60 * 1000;

const passageArgs = {
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
  verseEnd: v.optional(v.number()),
};

function toPassage(args: { book: string; chapter: number; verse: number; verseEnd?: number }): VerseImagePassage {
  return { book: args.book, chapter: args.chapter, verse: args.verse, endVerse: clampEndVerse(args.verse, args.verseEnd) };
}

async function passageRows(ctx: QueryCtx, passage: VerseImagePassage, version: string) {
  const rows = await ctx.db
    .query("verses")
    .withIndex("by_ref", (q) =>
      q
        .eq("version", version)
        .eq("book", passage.book)
        .eq("chapter", passage.chapter)
        .gte("verse", passage.verse)
        .lte("verse", passage.endVerse ?? passage.verse),
    )
    .collect();
  return rows.sort((a, b) => a.verse - b.verse);
}

/** El fondo de IA que ya le sirve a este pasaje: el suyo o el de una cita del feed que lo contiene. */
async function aiBackground(ctx: QueryCtx, passage: VerseImagePassage): Promise<string | null> {
  for (const ref of feedRefsCovering(passage)) {
    const url = await feedImageUrl(ctx, ref);
    if (url) return url;
  }
  return null;
}

export type VerseImageCompose = {
  version: string;
  /** Texto del pasaje en la versión de la persona; null si no está cargado. */
  text: string | null;
  /** Hasta dónde llegó el texto (un rango con versículos que faltan se acorta). */
  endVerse: number | null;
  aiImageUrl: string | null;
  photos: VerseImagePhoto[];
};

export const compose = query({
  args: passageArgs,
  handler: async (ctx, args): Promise<VerseImageCompose> => {
    const passage = toPassage(args);
    const version = await bibleVersionForIdentity(ctx);
    const rows = await passageRows(ctx, passage, version);
    // Solo versículos seguidos desde el primero: nunca un hueco en medio del texto.
    const contiguous = rows.filter((row, index) => row.verse === passage.verse + index);
    const last = contiguous.at(-1)?.verse ?? null;
    return {
      version,
      text: contiguous.length > 0 ? feedVerseText(contiguous.map((row) => row.text.trim()).join(" ")) : null,
      endVerse: last !== null && last > passage.verse ? last : null,
      aiImageUrl: await aiBackground(ctx, passage),
      photos: photosFor(verseImageRef(passage)),
    };
  },
});

export type GenerateBackgroundResult =
  | { status: "ready" }
  | { status: "busy" }
  | { status: "limit_reached" }
  | { status: "unavailable" }
  | { status: "failed"; reason: "no_credit" | "provider" };

type StartResult =
  | { status: "ready" | "busy" | "limit_reached" | "unavailable" }
  | { status: "go"; userId: Id<"users">; ref: string; text: string };

/**
 * Reserva el fondo de una cita y descuenta la cuota en la misma mutación: dos
 * toques seguidos (o dos personas con el mismo versículo) nunca pagan dos
 * imágenes. Si la cita ya tiene fondo, no cobra nada.
 */
export const start = internalMutation({
  args: { clerkId: v.string(), book: v.string(), chapter: v.number(), verse: v.number(), endVerse: v.union(v.number(), v.null()) },
  handler: async (ctx, args): Promise<StartResult> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) return { status: "unavailable" };
    const passage: VerseImagePassage = { book: args.book, chapter: args.chapter, verse: args.verse, endVerse: args.endVerse };
    if (await aiBackground(ctx, passage)) return { status: "ready" };

    // El prompt usa RV1909 (como el feed): la imagen es la misma para todas las versiones.
    const fitted = fitPassageText(await passageRows(ctx, passage, DEFAULT_BIBLE_VERSION));
    if (!fitted) return { status: "unavailable" };

    const ref = verseImageRef(passage);
    const row = await ctx.db
      .query("verseFeedMedia")
      .withIndex("by_ref_kind_version", (q) => q.eq("ref", ref).eq("kind", "image").eq("version", ""))
      .unique();
    const now = Date.now();
    if ((row?.inProgressUntil ?? 0) > now) return { status: "busy" };

    const quota = await consume(ctx, user._id, "verseImage");
    if (!quota.allowed) return { status: "limit_reached" };

    const reservation = { inProgressUntil: now + RESERVATION_MS, updatedAt: now };
    if (row) await ctx.db.patch(row._id, reservation);
    else await ctx.db.insert("verseFeedMedia", { ref, kind: "image", version: "", attempts: 0, ...reservation });
    return { status: "go", userId: user._id, ref, text: feedVerseText(fitted.text) };
  },
});

/** Si el proveedor falló, la cuota vuelve: la persona no pierde su fondo del día. */
export const refundQuota = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await refund(ctx, args.userId, "verseImage");
  },
});

/**
 * Genera el fondo con IA de una cita que todavía no tiene. Nunca bloquea
 * compartir: si OpenAI falla (sin saldo, caída), la app sigue con las fotos y
 * los colores. El guardado es el del feed, así que el feed también lo usa.
 */
export const generateBackground = action({
  args: passageArgs,
  handler: async (ctx, args): Promise<GenerateBackgroundResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "unavailable" };
    const passage = toPassage(args);
    const started: StartResult = await ctx.runMutation(internal.verseImage.start, {
      clerkId: identity.subject,
      ...passage,
    });
    if (started.status !== "go") return { status: started.status };

    let storageId: Id<"_storage"> | undefined;
    let failure: GenerateBackgroundResult | null = null;
    try {
      const blob = await generateFeedImage(feedImagePrompt({ ref: started.ref, topics: topicsFor(started.ref) }, started.text), aiMeter(ctx, "verse_feed"));
      storageId = await ctx.storage.store(blob);
    } catch (error) {
      console.error(`No se pudo generar el fondo de ${started.ref}`, error);
      failure = { status: "failed", reason: error instanceof AiCallError && error.kind === "quota" ? "no_credit" : "provider" };
    }
    // `save` libera la reserva. Una falla de acá no gasta intentos del feed: la cita sigue en su cola.
    await ctx.runMutation(internal.verseFeedMedia.save, {
      ref: started.ref,
      kind: "image",
      version: "",
      storageId,
      countAttempt: false,
    });
    if (failure) {
      await ctx.runMutation(internal.verseImage.refundQuota, { userId: started.userId });
      return failure;
    }
    return { status: "ready" };
  },
});
