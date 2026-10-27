import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { AiCallError } from "./adminKit/meter";
import { aiMeter } from "./aiUsage";
import { AVAILABLE_BIBLE_VERSIONS, DEFAULT_BIBLE_VERSION } from "./bibleVersions";
import { generateFeedImage } from "./images";
import { generateSpeech } from "./speech";
import { FEED_POOL, FEED_TOPIC_NAMES, feedPassage, type FeedPassage } from "./verseFeedCore";
import { feedPassageText, spokenText, textHash } from "./verseFeedText";

/**
 * Fondos y voz del feed de versículos (design/oleada-ux.md §Feed de
 * versículos). Cada cita del catálogo curado tiene una imagen vertical de IA
 * y una lectura en voz natural del texto exacto de RV1909. Se generan una vez
 * y se guardan en `_storage`: el feed solo lee URLs. Nada de esto opina ni
 * agrega contenido (regla dura #4): la imagen ilustra y la voz lee.
 *
 * Generar todo el catálogo (una vez, ~473 imágenes + ~473 voces):
 *   npx convex run verseFeedMedia:generateMissing '{"budget": 1000}'
 * No hay cron: el fundador decidió quedarse con lo ya generado (27 de
 * octubre de 2026). Lo que falta va con la foto del devocional y sin voz.
 */

export type FeedMediaKind = "image" | "audio";

/** Reintentos por cita antes de dejarla sin medio (y con la foto de siempre). */
export const MAX_ATTEMPTS = 3;
/** Generaciones por tanda; cada una corre en paralelo de a `PARALLEL`. */
const BATCH = 8;
const PARALLEL = 4;
/** Cuánto dura la reserva de una tanda (más que lo que tarda una acción). */
const CLAIM_MS = 15 * 60 * 1000;
/** Si una tanda entera falla por el proveedor (límite, caída), la próxima espera esto. */
const BACKOFF_MS = 60 * 1000;

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

/** URL del fondo de IA de una cita, o null si todavía no hay. */
export async function feedImageUrl(ctx: QueryCtx, ref: string): Promise<string | null> {
  const row = await mediaRow(ctx, ref, "image", "");
  return row?.storageId ? await ctx.storage.getUrl(row.storageId) : null;
}

/** URL de la voz de una cita, solo si leyó exactamente el texto que hoy muestra el feed. */
export async function feedAudioUrl(
  ctx: QueryCtx,
  ref: string,
  version: string,
  expectedHash: string,
): Promise<string | null> {
  const row = await mediaRow(ctx, ref, "audio", version);
  return row?.storageId && row.textHash === expectedHash ? await ctx.storage.getUrl(row.storageId) : null;
}

export type ClaimedMedia = { ref: string; kind: FeedMediaKind; version: string; text: string; textHash: string };

/**
 * Reserva lo que falta generar: cita × (imagen, voz por versión). Es una
 * mutación (no una consulta) para que dos tandas a la vez —el cron y una
 * corrida a mano— nunca paguen la misma cita. Salta lo listo, lo reservado
 * por otra tanda y lo que ya agotó sus intentos. Una voz que leyó otro texto
 * cuenta como faltante.
 */
export const claim = internalMutation({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<ClaimedMedia[]> => {
    const now = Date.now();
    const claimed: ClaimedMedia[] = [];
    const jobs: [FeedMediaKind, string][] = [
      ["image", DEFAULT_BIBLE_VERSION],
      ...AVAILABLE_BIBLE_VERSIONS.map((version) => ["audio", version] as [FeedMediaKind, string]),
    ];
    for (const passage of FEED_POOL) {
      for (const [kind, version] of jobs) {
        if (claimed.length >= args.limit) return claimed;
        const row = await mediaRow(ctx, passage.ref, kind, version);
        if ((row?.attempts ?? 0) >= MAX_ATTEMPTS) continue;
        if ((row?.inProgressUntil ?? 0) > now) continue;
        if (row?.storageId && kind === "image") continue;
        const fitted = await feedPassageText(ctx, passage, version);
        if (!fitted) continue;
        const text = spokenText(fitted.text);
        const hash = textHash(text);
        if (row?.storageId && row.textHash === hash) continue;
        const reservation = { inProgressUntil: now + CLAIM_MS, updatedAt: now };
        if (row) await ctx.db.patch(row._id, reservation);
        else
          await ctx.db.insert("verseFeedMedia", {
            ref: passage.ref,
            kind,
            version: versionFor(kind, version),
            attempts: 0,
            ...reservation,
          });
        claimed.push({ ref: passage.ref, kind, version, text, textHash: hash });
      }
    }
    return claimed;
  },
});

export const save = internalMutation({
  args: {
    ref: v.string(),
    kind: v.union(v.literal("image"), v.literal("audio")),
    version: v.string(),
    storageId: v.optional(v.id("_storage")),
    textHash: v.optional(v.string()),
    /** Una falla del proveedor (límite, caída) no gasta un intento de la cita. */
    countAttempt: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await mediaRow(ctx, args.ref, args.kind, args.version);
    // Los intentos cuentan fallas seguidas: un archivo nuevo los vuelve a cero.
    const attempts = args.storageId ? 0 : (existing?.attempts ?? 0) + (args.countAttempt ? 1 : 0);
    const update = {
      attempts,
      inProgressUntil: undefined,
      updatedAt: Date.now(),
      ...(args.storageId ? { storageId: args.storageId, textHash: args.textHash } : {}),
    };
    if (existing) {
      // Si había un archivo viejo y llegó uno nuevo, el viejo no queda huérfano.
      if (existing.storageId && args.storageId && existing.storageId !== args.storageId) {
        await ctx.storage.delete(existing.storageId);
      }
      await ctx.db.patch(existing._id, update);
    } else {
      await ctx.db.insert("verseFeedMedia", {
        ref: args.ref,
        kind: args.kind,
        version: versionFor(args.kind, args.version),
        ...update,
      });
    }
  },
});

/** Errores del proveedor que no dicen nada de la cita: límite de pedidos, caída o red. */
export function isTransientFailure(error: unknown): boolean {
  // Cualquier otra cosa (red, almacenamiento) sí gasta un intento: si no, una falla fija se reintentaría para siempre.
  if (!(error instanceof AiCallError)) return false;
  return (
    error.kind === "http_429" || error.kind === "quota" || error.kind === "timeout" || /^http_5\d\d$/.test(error.kind)
  );
}

/**
 * Genera lo que falta, de a tandas, y se vuelve a agendar hasta agotar el
 * `budget` (cantidad máxima de generaciones, para que el gasto tenga techo).
 * Solo se corre desde la terminal: el cliente no puede disparar
 * generaciones. Si la mitad de la tanda o más falla por el proveedor, la
 * próxima espera `BACKOFF_MS` en lugar de seguir chocando con el límite.
 */
export const generateMissing = internalAction({
  // `parallel` solo existe para los tests (convex-test no admite escrituras en paralelo en una acción).
  args: { budget: v.number(), parallel: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ generated: number; failed: number; remaining: number }> => {
    const parallel = Math.max(1, Math.floor(args.parallel ?? PARALLEL));
    const take = Math.min(BATCH, Math.max(0, Math.floor(args.budget)));
    if (take === 0) return { generated: 0, failed: 0, remaining: args.budget };
    const todo: ClaimedMedia[] = await ctx.runMutation(internal.verseFeedMedia.claim, { limit: take });
    const meter = aiMeter(ctx, "verse_feed");
    let generated = 0;
    let failed = 0;
    let transient = 0;
    let outOfCredit = false;

    for (let start = 0; start < todo.length; start += parallel) {
      await Promise.all(
        todo.slice(start, start + parallel).map(async (item) => {
          const passage = feedPassage(item.ref);
          if (!passage) return;
          let storageId: Id<"_storage"> | undefined;
          let countAttempt = true;
          try {
            const blob =
              item.kind === "image"
                ? await generateFeedImage(feedImagePrompt(passage, item.text), meter)
                : await generateSpeech(item.text, meter);
            storageId = await ctx.storage.store(blob);
            generated += 1;
          } catch (error) {
            failed += 1;
            if (error instanceof AiCallError && error.kind === "quota") outOfCredit = true;
            if (isTransientFailure(error)) {
              transient += 1;
              countAttempt = false;
            }
            console.error(`No se pudo generar ${item.kind} para ${item.ref}`, error);
          }
          await ctx.runMutation(internal.verseFeedMedia.save, {
            ref: item.ref,
            kind: item.kind,
            version: item.version,
            storageId,
            textHash: item.kind === "audio" ? item.textHash : undefined,
            countAttempt,
          });
        }),
      );
    }

    const remaining = args.budget - todo.length;
    // Tanda llena = puede quedar más: sigue en otra acción (cada una con su propio tiempo límite).
    // Sin saldo en OpenAI no tiene sentido seguir: la cadena para y el cron diario retoma cuando haya.
    if (outOfCredit) console.error("OpenAI sin saldo: se detiene la generación de medios del feed");
    if (todo.length === take && remaining > 0 && !outOfCredit) {
      // Con la mitad o más cayendo por el proveedor, se espera: seguir al toque solo choca con el límite.
      const delay = transient * 2 >= todo.length ? BACKOFF_MS : 0;
      await ctx.scheduler.runAfter(delay, internal.verseFeedMedia.generateMissing, { budget: remaining, parallel });
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
    const gaveUp = rows.filter((row) => row.attempts >= MAX_ATTEMPTS).length;
    return { catalog: FEED_POOL.length, images: ready("image"), audio: ready("audio"), gaveUp };
  },
});

/** Las URLs guardadas de una cita, para revisar a mano un fondo o una voz. */
export const mediaFor = internalQuery({
  args: { ref: v.string() },
  handler: async (ctx, args) => {
    const audio = await mediaRow(ctx, args.ref, "audio", DEFAULT_BIBLE_VERSION);
    return {
      image: await feedImageUrl(ctx, args.ref),
      audio: audio?.storageId ? await ctx.storage.getUrl(audio.storageId) : null,
    };
  },
});

/** Vuelve a darles intentos a las citas que se dieron por perdidas (después de arreglar la causa). */
export const resetGaveUp = internalMutation({
  args: {},
  handler: async (ctx) => {
    let reset = 0;
    for (const row of await ctx.db.query("verseFeedMedia").collect()) {
      if (row.attempts >= MAX_ATTEMPTS) {
        await ctx.db.patch(row._id, { attempts: 0 });
        reset += 1;
      }
    }
    return { reset };
  },
});

/**
 * Una sola vez, para las voces generadas antes de guardar la huella del texto:
 * se leyeron del mismo texto que hoy muestra el feed, así que se les anota.
 */
export const backfillTextHash = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    for (const row of await ctx.db.query("verseFeedMedia").collect()) {
      if (row.kind !== "audio" || !row.storageId || row.textHash) continue;
      const passage = feedPassage(row.ref);
      const fitted = passage ? await feedPassageText(ctx, passage, row.version) : null;
      if (!fitted) continue;
      await ctx.db.patch(row._id, { textHash: textHash(spokenText(fitted.text)) });
      updated += 1;
    }
    return { updated };
  },
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
