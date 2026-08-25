import { ConvexError, v } from "convex/values";
import { makeFunctionReference, type FunctionReference } from "convex/server";

import { api } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { generateStoryImage } from "./images";
import type { QuotaModule } from "./quotas";

/**
 * Catálogo editorial para el libro ilustrado. Las escenas contienen el texto que
 * verá el lector y un prompt completo, independiente de la UI, para que #25 lo
 * entregue al adaptador de generación sin volver a redactar el contenido.
 */
const ILLUSTRATION_STYLE =
  "Warm, serene watercolor biblical picture-book illustration for a family audience. " +
  "Historically respectful ancient Near East setting, expressive natural anatomy, soft golden light, " +
  "and a clear cinematic composition. No written text, captions, watermarks, modern objects, or anachronistic clothing.";

export type StoryScene = {
  id: string;
  order: number;
  title: string;
  narration: string;
  reference: string;
  imagePrompt: string;
};

export type StoryCatalogItem = {
  id: string;
  title: string;
  summary: string;
  reference: string;
  scenes: readonly StoryScene[];
};

function prompt(description: string) {
  return `${ILLUSTRATION_STYLE} ${description}`;
}

export const STORY_CATALOG: readonly StoryCatalogItem[] = [
  {
    id: "arca-de-noe",
    title: "El arca de Noé",
    summary: "Dios preserva a Noé, su familia y a los animales durante el diluvio.",
    reference: "Génesis 6–9",
    scenes: [
      {
        id: "arca-de-noe-1",
        order: 1,
        title: "Construir con obediencia",
        narration: "Noé construyó el arca tal como Dios le había indicado, aunque alrededor no se veía el mar.",
        reference: "Génesis 6:13–22",
        imagePrompt: prompt(
          "Noah, an elderly bearded man in simple earth-tone robes, leads his family building a vast wooden ark on dry land; timber beams, hand tools, and a wide open sky.",
        ),
      },
      {
        id: "arca-de-noe-2",
        order: 2,
        title: "Los animales entran",
        narration: "Parejas de animales llegaron al arca y Noé entró con su familia antes de que comenzara la lluvia.",
        reference: "Génesis 7:1–16",
        imagePrompt: prompt(
          "Pairs of elephants, sheep, doves, deer, and other animals walk peacefully toward the open wooden ark while Noah's family welcomes them; gentle gathering mood before rain.",
        ),
      },
      {
        id: "arca-de-noe-3",
        order: 3,
        title: "La paloma y la rama",
        narration: "Después de las aguas, una paloma regresó con una hoja de olivo: la tierra volvía a aparecer.",
        reference: "Génesis 8:6–12",
        imagePrompt: prompt(
          "A white dove flies through the ark's open window carrying a fresh olive leaf; Noah reaches toward it from inside the weathered wooden vessel, calm water and distant hills below.",
        ),
      },
      {
        id: "arca-de-noe-4",
        order: 4,
        title: "La señal del pacto",
        narration: "Dios puso el arco iris como señal de su pacto con toda criatura viviente.",
        reference: "Génesis 9:8–17",
        imagePrompt: prompt(
          "Noah and his multigenerational family stand beside animals on renewed green ground, looking toward a brilliant rainbow stretching across a clearing storm sky; hopeful covenant moment.",
        ),
      },
    ],
  },
  {
    id: "daniel-en-el-foso-de-los-leones",
    title: "Daniel en el foso de los leones",
    summary: "Daniel permanece fiel en oración y Dios lo guarda entre los leones.",
    reference: "Daniel 6",
    scenes: [
      {
        id: "daniel-en-el-foso-de-los-leones-1",
        order: 1,
        title: "Daniel ora",
        narration: "Aunque sabía que era peligroso, Daniel siguió orando a Dios como acostumbraba.",
        reference: "Daniel 6:10",
        imagePrompt: prompt(
          "Daniel, a dignified elderly Hebrew man in a modest robe, kneels in prayer by an open upper-room window facing Jerusalem; warm morning light and a quiet faithful expression.",
        ),
      },
      {
        id: "daniel-en-el-foso-de-los-leones-2",
        order: 2,
        title: "La piedra sellada",
        narration: "Daniel fue puesto en el foso y una gran piedra cerró la entrada con el sello del rey.",
        reference: "Daniel 6:16–17",
        imagePrompt: prompt(
          "At dusk, royal guards roll a heavy stone across the entrance of a deep lion's den while Daniel stands composed below; Persian palace architecture and solemn torchlight.",
        ),
      },
      {
        id: "daniel-en-el-foso-de-los-leones-3",
        order: 3,
        title: "Una noche guardado",
        narration: "Dios envió a su ángel y cerró la boca de los leones; Daniel no sufrió daño.",
        reference: "Daniel 6:21–22",
        imagePrompt: prompt(
          "Inside a rocky lion's den at night, Daniel sits peacefully among calm lions; a gentle shaft of heavenly light illuminates the scene without depicting God or an angel as a person.",
        ),
      },
      {
        id: "daniel-en-el-foso-de-los-leones-4",
        order: 4,
        title: "Daniel sale ileso",
        narration: "Al amanecer, Daniel salió del foso ileso porque había confiado en su Dios.",
        reference: "Daniel 6:19–23",
        imagePrompt: prompt(
          "At sunrise, King Darius and attendants look with relief as Daniel is lifted safely from the lion's den; the lions remain below, peaceful and unharmed.",
        ),
      },
    ],
  },
  {
    id: "el-mar-rojo-se-abre",
    title: "El mar que se abrió",
    summary: "Dios abre camino para Israel entre el mar y el ejército egipcio.",
    reference: "Éxodo 14",
    scenes: [
      {
        id: "el-mar-rojo-se-abre-1",
        order: 1,
        title: "Entre el mar y el ejército",
        narration: "El pueblo vio venir a los egipcios y tuvo miedo al quedar frente al mar.",
        reference: "Éxodo 14:5–10",
        imagePrompt: prompt(
          "A large Israelite camp with families, tents, and pack animals stands at the shore of the Red Sea while distant Egyptian chariots approach across the desert; tension but no violence.",
        ),
      },
      {
        id: "el-mar-rojo-se-abre-2",
        order: 2,
        title: "No tengan miedo",
        narration: "Moisés animó al pueblo a estar firme y ver la salvación de Dios.",
        reference: "Éxodo 14:13–14",
        imagePrompt: prompt(
          "Moses, an elderly bearded leader holding a wooden staff, faces worried Israelite families at the seashore and raises one hand to encourage them; wind moves robes and sea mist.",
        ),
      },
      {
        id: "el-mar-rojo-se-abre-3",
        order: 3,
        title: "Un camino en el mar",
        narration: "Moisés extendió su mano y el mar se dividió; el pueblo caminó por tierra seca entre las aguas.",
        reference: "Éxodo 14:21–22",
        imagePrompt: prompt(
          "Epic wide view of Moses leading Israelite families, children, and animals along a dry path between towering walls of parted sea water; moonlit blue water and safe passage.",
        ),
      },
      {
        id: "el-mar-rojo-se-abre-4",
        order: 4,
        title: "Al otro lado",
        narration: "Israel llegó a salvo a la otra orilla y vio que Dios los había librado.",
        reference: "Éxodo 14:29–31",
        imagePrompt: prompt(
          "On the far shore at dawn, Israelite families embrace and sing with gratitude, Moses holding his staff nearby; the sea glows behind them, focusing on relief and communal celebration.",
        ),
      },
    ],
  },
  {
    id: "ester-ante-el-rey",
    title: "Ester ante el rey",
    summary: "Ester arriesga su posición para interceder por su pueblo.",
    reference: "Ester 4–8",
    scenes: [
      {
        id: "ester-ante-el-rey-1",
        order: 1,
        title: "Un momento para hablar",
        narration: "Mardoqueo llamó a Ester a no guardar silencio ante la amenaza contra su pueblo.",
        reference: "Ester 4:13–14",
        imagePrompt: prompt(
          "In a secluded Persian palace courtyard, Mordecai in simple Jewish clothing speaks earnestly with Queen Esther in dignified royal garments; a tense but respectful private conversation.",
        ),
      },
      {
        id: "ester-ante-el-rey-2",
        order: 2,
        title: "Ayuno y valentía",
        narration: "Ester pidió ayuno y se preparó para entrar ante el rey, aun sabiendo el riesgo.",
        reference: "Ester 4:15–17",
        imagePrompt: prompt(
          "Queen Esther stands quietly by a palace window at first light, wearing simple elegant Persian royal clothing; her attendants respectfully wait nearby, conveying prayerful courage and preparation.",
        ),
      },
      {
        id: "ester-ante-el-rey-3",
        order: 3,
        title: "El cetro extendido",
        narration: "El rey vio a Ester en el patio interior y le extendió el cetro de oro.",
        reference: "Ester 5:1–3",
        imagePrompt: prompt(
          "Grand Persian throne room with King Ahasuerus seated at a distance, extending a golden scepter toward Queen Esther as she stands at the entrance; dramatic respectful palace scene.",
        ),
      },
      {
        id: "ester-ante-el-rey-4",
        order: 4,
        title: "Ester intercede",
        narration: "Ester reveló el peligro y pidió al rey que salvara a su pueblo.",
        reference: "Ester 7:3–6",
        imagePrompt: prompt(
          "At a formal Persian banquet, Queen Esther speaks with calm courage to King Ahasuerus while Haman sits distressed in the background; richly detailed table, no text or symbols.",
        ),
      },
    ],
  },
  {
    id: "david-y-goliat",
    title: "David y Goliat",
    summary: "David confía en Dios frente al desafío de Goliat.",
    reference: "1 Samuel 17",
    scenes: [
      {
        id: "david-y-goliat-1",
        order: 1,
        title: "David escucha el desafío",
        narration: "David llegó al campamento y oyó a Goliat desafiar al ejército de Israel.",
        reference: "1 Samuel 17:20–23",
        imagePrompt: prompt(
          "Young David, a humble teenage shepherd with curly dark hair and a simple tunic, arrives at the Israelite camp carrying food; across the valley, the towering armored Goliath challenges from afar.",
        ),
      },
      {
        id: "david-y-goliat-2",
        order: 2,
        title: "Cinco piedras lisas",
        narration: "David tomó su cayado, escogió cinco piedras lisas del arroyo y llevó su honda.",
        reference: "1 Samuel 17:40",
        imagePrompt: prompt(
          "David kneels beside a clear stream choosing five smooth stones, his shepherd's staff and leather sling beside him; peaceful valley landscape before the confrontation.",
        ),
      },
      {
        id: "david-y-goliat-3",
        order: 3,
        title: "En el nombre del Señor",
        narration: "David enfrentó a Goliat confiando no en armas, sino en el nombre del Señor.",
        reference: "1 Samuel 17:45–47",
        imagePrompt: prompt(
          "In a broad valley between two armies, young David with a sling faces the distant giant Goliath in armor; David appears small but steady, with a dramatic sky and no graphic violence.",
        ),
      },
      {
        id: "david-y-goliat-4",
        order: 4,
        title: "La victoria inesperada",
        narration: "La piedra de la honda derribó a Goliat, y el ejército de Israel celebró la liberación.",
        reference: "1 Samuel 17:48–51",
        imagePrompt: prompt(
          "David stands at a respectful distance after Goliath has fallen face-down in the valley, while Israelite soldiers react with amazed joyful relief; non-graphic, no blood or weapons in focus.",
        ),
      },
    ],
  },
];

export function findStoryById(storyId: string): StoryCatalogItem | null {
  return STORY_CATALOG.find((story) => story.id === storyId) ?? null;
}

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

export const generateImages = action({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const story = await ctx.runQuery(loadForGenerationRef, { storyId: args.storyId });
    if (!story) return null;
    const catalog = findStoryById(story.catalogId);
    if (!catalog) return null;
    for (const scene of catalog.scenes) {
      try {
        const storageId = await ctx.storage.store(await generateStoryImage(scene.imagePrompt));
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
