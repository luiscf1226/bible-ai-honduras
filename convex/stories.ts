import { ConvexError, v } from "convex/values";
import { makeFunctionReference, type FunctionReference } from "convex/server";

import { api } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { aiMeter } from "./aiUsage";
import { generateStoryImage } from "./images";
import type { QuotaModule } from "./quotas";
import { findStoryById, STORY_CATALOG } from "./storyCatalog";

export { findStoryById, STORY_CATALOG } from "./storyCatalog";
export type { StoryCatalogItem, StoryScene } from "./storyCatalog";

/** Catálogo que el selector de historias consume antes de generar una muestra o una historia Pro. */
export const list = query({
  args: {},
  handler: () => STORY_CATALOG,
});

/** Detalle completo, incluidas escenas y prompts, para el generador del issue #25. */
export const getById = query({
  args: { storyId: v.string() },
  handler: (_ctx, args) => findStoryById(args.storyId),
});

const generateImagesRef = makeFunctionReference<"action", { storyId: string }, null>("stories:generateImages");
const loadForGenerationRef = makeFunctionReference<"query", { storyId: string }, any>("stories:loadForGeneration");
const saveSceneRef = makeFunctionReference<"mutation", { storyId: string; sceneId: string; storageId?: string; failed?: boolean }, null>("stories:saveScene");
const consumeStoryQuota: FunctionReference<
  "mutation",
  "public",
  { module: QuotaModule },
  { allowed: true; reason?: undefined; module?: undefined } | { allowed: false; reason: "limit_reached"; module: QuotaModule }
> = api.quotas.checkAndConsume;

async function requireUser(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("No autenticado");
  const user = await ctx.db.query("users").withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject)).unique();
  if (!user) throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
  return user;
}

// La cuota se consume antes de agendar el proveedor. Una escena nunca acepta
// prompts del cliente: se deriva del catálogo editorial por catalogId.
export const create = mutation({
  args: { storyId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const catalog = findStoryById(args.storyId);
    if (!catalog) throw new ConvexError("Historia no encontrada");
    // Volver a abrir una historia ya generada no gasta cupo: la cuota es por
    // generación, y las historias generadas se pueden volver a consultar. Si
    // la generación anterior falló, se reintenta sobre el mismo registro.
    const previous = (
      await ctx.db.query("stories").withIndex("by_user_catalog", (q) => q.eq("userId", user._id).eq("catalogId", catalog.id)).collect()
    ).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (previous) {
      if (previous.status === "failed") {
        await ctx.db.patch(previous._id, {
          status: "generating",
          scenes: previous.scenes.map((scene) => (scene.status === "failed" ? { ...scene, status: "generating" as const } : scene)),
        });
        await ctx.scheduler.runAfter(0, generateImagesRef, { storyId: previous._id });
      }
      return { allowed: true as const, storyId: previous._id };
    }
    const quota = await ctx.runMutation(consumeStoryQuota, { module: "stories" });
    if (!quota.allowed) return quota;
    const storyId = await ctx.db.insert("stories", {
      userId: user._id,
      catalogId: catalog.id,
      status: "generating",
      createdAt: Date.now(),
      scenes: catalog.scenes.map((scene) => ({
        id: scene.id, order: scene.order, title: scene.title, narration: scene.narration, reference: scene.reference, status: "generating" as const,
      })),
    });
    await ctx.scheduler.runAfter(0, generateImagesRef, { storyId });
    return { allowed: true as const, storyId };
  },
});

export const loadForGeneration = internalQuery({
  args: { storyId: v.id("stories") },
  handler: (ctx, args) => ctx.db.get(args.storyId),
});

export const saveScene = internalMutation({
  args: { storyId: v.id("stories"), sceneId: v.string(), storageId: v.optional(v.id("_storage")), failed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);
    if (!story) return;
    const scenes = story.scenes.map((scene) => scene.id !== args.sceneId ? scene : {
      ...scene, status: args.failed ? "failed" as const : "ready" as const, ...(args.storageId ? { storageId: args.storageId } : {}),
    });
    await ctx.db.patch(story._id, { scenes, status: scenes.every((scene) => scene.status !== "generating") ? (scenes.some((scene) => scene.status === "failed") ? "failed" : "ready") : "generating" });
  },
});

// Solo la agenda `create`: el cliente no puede disparar generaciones (costo de OpenAI).
export const generateImages = internalAction({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.runQuery(loadForGenerationRef, { storyId: args.storyId });
    if (!story) return null;
    const catalog = findStoryById(story.catalogId);
    if (!catalog) return null;
    const meter = aiMeter(ctx, "stories");
    const ready = new Set(story.scenes.filter((scene: { status: string }) => scene.status === "ready").map((scene: { id: string }) => scene.id));
    for (const scene of catalog.scenes) {
      if (ready.has(scene.id)) continue;
      try {
        const storageId = await ctx.storage.store(await generateStoryImage(scene.imagePrompt, meter));
        await ctx.runMutation(saveSceneRef, { storyId: story._id, sceneId: scene.id, storageId });
      } catch {
        await ctx.runMutation(saveSceneRef, { storyId: story._id, sceneId: scene.id, failed: true });
      }
    }
    return null;
  },
});

export const latestForViewer = query({
  args: { storyId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const records = await ctx.db.query("stories").withIndex("by_user_catalog", (q) => q.eq("userId", user._id).eq("catalogId", args.storyId)).collect();
    const story = records.sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!story) return null;
    return { ...story, scenes: await Promise.all(story.scenes.map(async (scene) => ({ ...scene, uri: scene.storageId ? await ctx.storage.getUrl(scene.storageId) : null }))) };
  },
});
