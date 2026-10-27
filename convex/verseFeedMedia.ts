import { v } from "convex/values";

import { feedVerseText } from "../src/features/feed/feedLogic";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { aiMeter } from "./aiUsage";
import { AVAILABLE_BIBLE_VERSIONS, DEFAULT_BIBLE_VERSION } from "./bibleVersions";
import { generateFeedImage } from "./images";
import { generateSpeech } from "./speech";
import { FEED_POOL, FEED_TOPIC_NAMES, feedPassage, fitPassageText, type FeedPassage } from "./verseFeedCore";

/**
 * Fondos y voz del feed de versículos (design/oleada-ux.md §Feed de
 * versículos). Cada cita del catálogo curado tiene una imagen vertical de IA
 * y una lectura en voz natural del texto exacto de RV1909. Se generan una vez
 * y se guardan en `_storage`: el feed solo lee URLs. Nada de esto opina ni
 * agrega contenido (regla dura #4): la imagen ilustra y la voz lee.
 *
 * Generar todo el catálogo (una vez, ~473 imágenes + ~473 voces):
 *   npx convex run verseFeedMedia:generateMissing '{"budget": 1000}'
 * El cron diario completa con `DAILY_BUDGET` lo que falte (citas nuevas).
 */

export type FeedMediaKind = "image" | "audio";

/** Reintentos por cita antes de dejarla sin medio (y con la foto de siempre). */
export const MAX_ATTEMPTS = 3;
/** Generaciones por tanda; cada una corre en paralelo de a `PARALLEL`. */
const BATCH = 8;
const PARALLEL = 4;
/** Lo que el cron diario puede gastar en citas nuevas. */
export const DAILY_BUDGET = 20;

const IMAGE_STYLE =
  "Vertical 2:3 background for a Bible verse app. Serene, painterly scene with soft natural light and a calm, slightly muted " +
  "palette that harmonizes with sand, clay, sage green and deep brown (time of day and weather may vary). Calm composition with open, uncluttered space in the middle and lower half, where " +
  "white text will be placed over it. No written text, letters, numbers, logos or watermarks. Never depict Jesus, God or the " +
  "Holy Spirit as a person, figure, face or silhouette; prefer landscapes, nature, light, sky, water and symbolic objects. If " +
  "people appear, only small distant figures or seen from behind, never close-up faces. Ancient Near East or natural setting, " +
  "no modern objects.";

/**
 * Una escena sugerida por cita (fija, por el hash de la cita) para que el
 * feed no sean 473 atardeceres iguales al deslizar. El modelo la usa si no
 * hay una imagen más clara en el pasaje.
 */
export const FEED_SCENES = [
  "misty mountains at dawn",
  "a starry night sky over quiet hills",
  "a calm sea shore at first light",
  "an olive grove in soft afternoon light",
  "a golden wheat field at harvest",
  "storm clouds parting with rays of light",
  "a forest path with light through the trees",
  "a winding desert path at sunrise",
  "a still lake reflecting the sky",
  "a vineyard on gentle hills",
  "green pastures with a distant flock of sheep",
  "an ancient stone city at dusk",
  "a single oil lamp glowing on a wooden table",
  "a flowing river between rocks",
  "a lone tree on a hill under a wide sky",
  "rain falling on fields with a rainbow",
  "a fig tree and a stone well in a quiet village",
  "high cliffs and an eagle soaring",
] as const;

function sceneFor(ref: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < ref.length; index += 1) hash = Math.imul(hash ^ ref.charCodeAt(index), 0x01000193);
  return FEED_SCENES[(hash >>> 0) % FEED_SCENES.length];
}

/** Prompt del fondo: el estilo fijo, una escena sugerida y el pasaje que la inspira. Sin texto de la app ni del usuario. */
export function feedImagePrompt(passage: Pick<FeedPassage, "ref" | "topics">, text: string): string {
  const topic = passage.topics[0] ? FEED_TOPIC_NAMES.get(passage.topics[0]) : null;
  const theme = topic ? ` Theme: ${topic}.` : "";
  return (
    `${IMAGE_STYLE}${theme} Suggested scene: ${sceneFor(passage.ref)} (use a clearer image from the passage if there is one). ` +
    `Inspired by this Bible passage (${passage.ref}, Reina-Valera 1909): "${text}"`
  );
}

const versionFor = (kind: FeedMediaKind, version: string) => (kind === "image" ? "" : version);

async function mediaRow(ctx: QueryCtx, ref: string, kind: FeedMediaKind, version: string) {
  return await ctx.db
    .query("verseFeedMedia")
    .withIndex("by_ref_kind_version", (q) => q.eq("ref", ref).eq("kind", kind).eq("version", versionFor(kind, version)))
    .unique();
}

/** URL guardada del fondo o de la voz de una cita, o null si todavía no hay. */
export async function feedMediaUrl(
  ctx: QueryCtx,
  ref: string,
  kind: FeedMediaKind,
  version: string,
): Promise<string | null> {
  const row = await mediaRow(ctx, ref, kind, version);
  return row?.storageId ? await ctx.storage.getUrl(row.storageId) : null;
}

export type PendingMedia = { ref: string; kind: FeedMediaKind; version: string; text: string };

/** Lo que falta generar: cita × (imagen, voz por versión), sin las que ya agotaron reintentos. */
export const pending = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<PendingMedia[]> => {
    const result: PendingMedia[] = [];
    for (const passage of FEED_POOL) {
      for (const [kind, version] of [
        ["image", DEFAULT_BIBLE_VERSION],
        ...AVAILABLE_BIBLE_VERSIONS.map((available) => ["audio", available] as const),
      ] as const) {
        if (result.length >= args.limit) return result;
        const row = await mediaRow(ctx, passage.ref, kind, version);
        if (row?.storageId || (row?.attempts ?? 0) >= MAX_ATTEMPTS) continue;
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
        // Mismo texto que muestra el feed (acortado si no entra), para que la voz lea lo que se ve.
        const fitted = fitPassageText(rows);
        if (!fitted) continue;
        result.push({ ref: passage.ref, kind, version, text: feedVerseText(fitted.text) });
      }
    }
    return result;
  },
});

export const save = internalMutation({
  args: {
    ref: v.string(),
    kind: v.union(v.literal("image"), v.literal("audio")),
    version: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const version = versionFor(args.kind, args.version);
    const existing = await ctx.db
      .query("verseFeedMedia")
      .withIndex("by_ref_kind_version", (q) => q.eq("ref", args.ref).eq("kind", args.kind).eq("version", version))
      .unique();
    const update = { storageId: args.storageId, attempts: (existing?.attempts ?? 0) + 1, updatedAt: Date.now() };
    if (existing) {
      // Si había un archivo viejo y llegó uno nuevo, el viejo no queda huérfano.
      if (existing.storageId && args.storageId && existing.storageId !== args.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, { ...update, storageId: args.storageId ?? existing.storageId });
    } else {
      await ctx.db.insert("verseFeedMedia", { ref: args.ref, kind: args.kind, version, ...update });
    }
  },
});

/**
 * Genera lo que falta, de a tandas, y se vuelve a agendar hasta agotar el
 * `budget` (cantidad máxima de generaciones, para que el gasto tenga techo).
 * Solo se corre desde la terminal o el cron: el cliente no puede disparar
 * generaciones.
 */
export const generateMissing = internalAction({
  // `parallel` solo existe para los tests (convex-test no admite escrituras en paralelo en una acción).
  args: { budget: v.number(), parallel: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ generated: number; failed: number; remaining: number }> => {
    const parallel = Math.max(1, Math.floor(args.parallel ?? PARALLEL));
    const take = Math.min(BATCH, Math.max(0, Math.floor(args.budget)));
    if (take === 0) return { generated: 0, failed: 0, remaining: args.budget };
    const todo: PendingMedia[] = await ctx.runQuery(internal.verseFeedMedia.pending, { limit: take });
    const meter = aiMeter(ctx, "verse_feed");
    let generated = 0;
    let failed = 0;

    for (let start = 0; start < todo.length; start += parallel) {
      await Promise.all(
        todo.slice(start, start + parallel).map(async (item) => {
          const passage = feedPassage(item.ref);
          if (!passage) return;
          let storageId: Id<"_storage"> | undefined;
          try {
            const blob =
              item.kind === "image"
                ? await generateFeedImage(feedImagePrompt(passage, item.text), meter)
                : await generateSpeech(item.text, meter);
            storageId = await ctx.storage.store(blob);
            generated += 1;
          } catch (error) {
            failed += 1;
            console.error(`No se pudo generar ${item.kind} para ${item.ref}`, error);
          }
          await ctx.runMutation(internal.verseFeedMedia.save, {
            ref: item.ref,
            kind: item.kind,
            version: item.version,
            storageId,
          });
        }),
      );
    }

    const remaining = args.budget - todo.length;
    // Tanda llena = puede quedar más: sigue en otra acción (cada una con su propio tiempo límite).
    if (todo.length === take && remaining > 0) {
      await ctx.scheduler.runAfter(0, internal.verseFeedMedia.generateMissing, { budget: remaining, parallel });
    }
    return { generated, failed, remaining };
  },
});

/** Cuánto está listo: para ver el avance desde la terminal. */
export const progress = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("verseFeedMedia").collect();
    const ready = (kind: FeedMediaKind) => rows.filter((row) => row.kind === kind && row.storageId).length;
    const gaveUp = rows.filter((row) => !row.storageId && row.attempts >= MAX_ATTEMPTS).length;
    return { catalog: FEED_POOL.length, images: ready("image"), audio: ready("audio"), gaveUp };
  },
});

/** Las URLs guardadas de una cita, para revisar a mano un fondo o una voz. */
export const mediaFor = internalQuery({
  args: { ref: v.string() },
  handler: async (ctx, args) => ({
    image: await feedMediaUrl(ctx, args.ref, "image", DEFAULT_BIBLE_VERSION),
    audio: await feedMediaUrl(ctx, args.ref, "audio", DEFAULT_BIBLE_VERSION),
  }),
});

/** Borra el fondo o la voz guardados de unas citas (y su archivo), para volver a generarlos. */
export const clearMedia = internalMutation({
  args: { refs: v.array(v.string()), kind: v.union(v.literal("image"), v.literal("audio")) },
  handler: async (ctx, args) => {
    let cleared = 0;
    for (const ref of args.refs) {
      const rows = await ctx.db
        .query("verseFeedMedia")
        .withIndex("by_ref_kind_version", (q) => q.eq("ref", ref).eq("kind", args.kind))
        .collect();
      for (const row of rows) {
        if (row.storageId) await ctx.storage.delete(row.storageId);
        await ctx.db.delete(row._id);
        cleared += 1;
      }
    }
    return { cleared };
  },
});
