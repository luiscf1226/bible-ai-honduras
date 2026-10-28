import personajesJson from "../docs/content/personajes-feed.json";
import { findBook } from "../src/lib/bibleBooks";
import { STORY_CATALOG, type StoryCatalogItem } from "./storyCatalog";
import { TEXT_STORY_CATALOG, type TextStoryCatalogItem } from "./textStoriesCatalog";
import { fallbackFeedPhoto, seededRandom } from "./verseFeedCore";
import { FEED_RECENT_GUARD, FEED_TEXT_MAX } from "./verseFeedLimits";
import { voiceCharacters } from "./voicesCatalog";

/**
 * Reels del feed (design/oleada-ux.md §Reels del feed): entre los versículos
 * entran historias contadas con voz y personajes que hablan en 1ra persona.
 * Un reel es una serie de escenas (imagen + texto + voz) que avanzan solas,
 * como un video. Nada se genera en runtime (regla dura #4): las historias son
 * los catálogos de Historias (ilustradas y en texto) y los monólogos son
 * curados a mano en `docs/content/personajes-feed.json`, cada uno anclado a
 * un pasaje. Solo personajes humanos del catálogo de Voces (regla dura #2).
 */

export type FeedReelKind = "story" | "character";

export type FeedReelScene = {
  /** Id de los medios de la escena (imagen y voz): "historia:creacion#2". */
  mediaRef: string;
  /** Lo que se ve y lo que dice la voz, sin la cita entre paréntesis. */
  text: string;
  /** Cita de la escena ("Lucas 2:1–7"); si la página no trae una, la de la historia. */
  reference: string;
  /** Adónde abre "Leer": el capítulo de la cita, con el versículo si lo hay. */
  book: string;
  chapter: number;
  verse: number | null;
  /** Prompt del fondo, armado del catálogo (nunca de texto de la app o del usuario). */
  imagePrompt: string;
};

export type FeedReel = {
  /** "historia:creacion" o "personaje:moises:1". Es lo que guarda el ♥. */
  ref: string;
  kind: FeedReelKind;
  /** Título de la historia o nombre del personaje. */
  title: string;
  /** Cita de la historia ("Génesis 1–2") o etiqueta del personaje ("Éxodo · el que dudó de sí mismo"). */
  subtitle: string;
  /** Personaje de Voces para "Conversar" (el del monólogo, o el que invita la historia). */
  voiceSlug: string | null;
  scenes: readonly FeedReelScene[];
  /** Foto de un devocional para las escenas que todavía no tienen su imagen. */
  fallbackImageUrl: string;
  fallbackImageAlt: string;
};

const REEL_STYLE =
  "Vertical 2:3 illustration for a Bible story app. Warm, serene watercolor biblical picture-book style for a family " +
  "audience, soft natural light and a calm palette that harmonizes with sand, clay, sage green and deep brown. " +
  "Historically respectful ancient Near East setting, no modern objects or anachronistic clothing. Keep the middle and " +
  "lower half calm and uncluttered: white text will be placed over it. No written text, letters, numbers, logos or " +
  "watermarks. Never depict Jesus, God or the Holy Spirit as a person, figure, face or silhouette: in scenes about Jesus, " +
  "show the place, the people around seen from behind, light or symbolic objects instead. Other people may appear; " +
  "avoid close-up faces.";

/** La cita entre paréntesis con la que terminan las páginas de las historias en texto. */
const TRAILING_REFERENCE = /\s*\(([^()]*\d[^()]*)\)\s*([.!?…]*)\s*$/u;

/**
 * Separa la cita del final de una página ("…en un pesebre (Lucas 2:1–7).")
 * para mostrarla aparte y que la voz no la lea. Sin cita, la página va entera.
 */
export function splitPageReference(page: string): { text: string; reference: string | null } {
  const match = TRAILING_REFERENCE.exec(page);
  if (!match) return { text: page.trim(), reference: null };
  const body = page.slice(0, match.index).trim();
  // El punto quedaba después del paréntesis: vuelve al final de la frase.
  const closing = match[2] || ".";
  const text = /[.!?…]$/u.test(body) ? body : `${body}${closing}`;
  return { text, reference: match[1].trim() };
}

const PASSAGE = /^(.+?)\s+(\d+)(?::(\d+))?/u;

/**
 * Adónde abre "Leer" una cita editorial ("Lucas 2:1–7", "1 Samuel 17",
 * "Génesis 25; 27; 33"): el primer capítulo que nombra. null si el libro no
 * es del canon; quien la use cae en la cita de la historia.
 */
export function passageOf(reference: string): { book: string; chapter: number; verse: number | null } | null {
  const match = PASSAGE.exec(reference.trim());
  if (!match) return null;
  const book = findBook(match[1]);
  if (!book) return null;
  const chapter = Number(match[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  return { book: book.name, chapter, verse: match[3] ? Number(match[3]) : null };
}

/** Historias en texto que ya están ilustradas: el feed usa la ilustrada y no repite la historia. */
const ILLUSTRATED_TWINS: Readonly<Record<string, string>> = {
  "arca-de-noe": "arca-de-noe",
  "daniel-en-el-foso": "daniel-en-el-foso-de-los-leones",
  "el-mar-rojo-se-abre": "el-mar-rojo-se-abre",
  "ester-ante-el-rey": "ester-ante-el-rey",
  "david-y-goliat": "david-y-goliat",
};

function photo(ref: string) {
  const { imageAlt, imageUrl } = fallbackFeedPhoto(ref);
  return { fallbackImageAlt: imageAlt, fallbackImageUrl: imageUrl };
}

function illustratedReel(story: StoryCatalogItem, twin: TextStoryCatalogItem | undefined): FeedReel {
  const ref = `historia:${story.id}`;
  const home = twin
    ? { book: twin.book, chapter: twin.chapter, verse: twin.verse ?? null }
    : passageOf(story.reference);
  return {
    ref,
    kind: "story",
    title: story.title,
    subtitle: story.reference,
    voiceSlug: twin?.voiceSlug ?? null,
    scenes: [...story.scenes]
      .sort((a, b) => a.order - b.order)
      .map((scene, index) => {
        const passage = passageOf(scene.reference) ?? home;
        if (!passage) throw new Error(`Historia ${story.id}: la escena ${scene.id} no tiene un pasaje para "Leer"`);
        return {
          mediaRef: `${ref}#${index + 1}`,
          text: scene.narration,
          reference: scene.reference,
          ...passage,
          imagePrompt: `${REEL_STYLE} ${scene.imagePrompt}`,
        };
      }),
    ...photo(ref),
  };
}

function textReel(story: TextStoryCatalogItem): FeedReel {
  const ref = `historia:${story.id}`;
  const home = { book: story.book, chapter: story.chapter, verse: story.verse ?? null };
  return {
    ref,
    kind: "story",
    title: story.title,
    subtitle: story.reference,
    voiceSlug: story.voiceSlug ?? null,
    scenes: story.pages.map((page, index) => {
      const { reference, text } = splitPageReference(page);
      const shown = reference ?? story.reference;
      return {
        mediaRef: `${ref}#${index + 1}`,
        text,
        reference: shown,
        ...((reference ? passageOf(reference) : null) ?? home),
        imagePrompt:
          `${REEL_STYLE} Scene from the Bible story "${story.title}" (${shown}, Reina-Valera 1909). ` +
          `Illustrate this moment: "${text}"`,
      };
    }),
    ...photo(ref),
  };
}

type Monologue = {
  slug: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  scene: string;
};

const MONOLOGUES = (personajesJson as { monologues: Monologue[] }).monologues;
const CHARACTERS = new Map(voiceCharacters.map((character) => [character.slug, character]));

/** Los monólogos de cada personaje, como reels de una escena: "personaje:moises:1", "personaje:moises:2"… */
export function buildCharacterReels(monologues: readonly Monologue[] = MONOLOGUES): FeedReel[] {
  const counts = new Map<string, number>();
  return monologues.map((monologue) => {
    const character = CHARACTERS.get(monologue.slug);
    if (!character) throw new Error(`personajes-feed: "${monologue.slug}" no es un personaje de Voces`);
    const book = findBook(monologue.book);
    if (!book || book.name !== monologue.book)
      throw new Error(`personajes-feed: libro "${monologue.book}" desconocido`);
    const index = (counts.get(monologue.slug) ?? 0) + 1;
    counts.set(monologue.slug, index);
    const ref = `personaje:${monologue.slug}:${index}`;
    return {
      ref,
      kind: "character",
      title: character.name,
      subtitle: character.tag,
      voiceSlug: character.slug,
      scenes: [
        {
          mediaRef: `${ref}#1`,
          text: monologue.text,
          reference: monologue.reference,
          book: monologue.book,
          chapter: monologue.chapter,
          verse: monologue.verse,
          imagePrompt: `${REEL_STYLE} ${monologue.scene}. Inspired by ${monologue.reference} (Reina-Valera 1909).`,
        },
      ],
      ...photo(ref),
    };
  });
}

/** Todas las historias del feed: las ilustradas y las en texto que no tienen gemela ilustrada. */
export function buildStoryReels(
  illustrated: readonly StoryCatalogItem[] = STORY_CATALOG,
  texts: readonly TextStoryCatalogItem[] = TEXT_STORY_CATALOG,
): FeedReel[] {
  const twinOf = new Map(Object.entries(ILLUSTRATED_TWINS).map(([textId, storyId]) => [storyId, textId]));
  const textById = new Map(texts.map((story) => [story.id, story]));
  const fromIllustrated = illustrated.map((story) => {
    const twinId = twinOf.get(story.id);
    return illustratedReel(story, twinId ? textById.get(twinId) : undefined);
  });
  const fromText = texts.filter((story) => !(story.id in ILLUSTRATED_TWINS)).map(textReel);
  return [...fromIllustrated, ...fromText];
}

export const REEL_POOL: readonly FeedReel[] = [...buildStoryReels(), ...buildCharacterReels()];
const REEL_BY_REF = new Map(REEL_POOL.map((reel) => [reel.ref, reel]));
const SCENE_BY_MEDIA_REF = new Map(
  REEL_POOL.flatMap((reel) => reel.scenes.map((scene) => [scene.mediaRef, { reel, scene }])),
);

export function feedReel(ref: string): FeedReel | null {
  return REEL_BY_REF.get(ref) ?? null;
}

/** La escena (y su reel) de un id de medio, para generar su imagen y su voz. */
export function reelScene(mediaRef: string): { reel: FeedReel; scene: FeedReelScene } | null {
  return SCENE_BY_MEDIA_REF.get(mediaRef) ?? null;
}

/** Ningún texto de un reel pasa lo que entra en una pantalla (lo cuida el test del catálogo). */
export { FEED_TEXT_MAX };

/**
 * Voz de cada reel (gpt-4o-mini-tts). Las historias las cuenta un narrador;
 * cada personaje tiene su propia voz. Las instrucciones solo dan el tono: el
 * texto se lee tal cual, y lo que va entre comillas son palabras de otro,
 * que se dicen sin imitar a nadie (nunca a Dios ni a Jesús).
 */
export type ReelVoice = { voice: string; instructions: string };

const READ_EXACTLY =
  "Leé el texto exactamente como está, sin agregar palabras ni comentarios. Lo que va entre comillas son palabras de otra " +
  "persona: decilas con naturalidad, sin imitar voces.";

export const NARRATOR_VOICE: ReelVoice = {
  voice: "sage",
  instructions:
    "Contás una historia de la Biblia en español latinoamericano neutro, con voz cálida, serena y pausada de narrador, para " +
    `toda la familia. ${READ_EXACTLY}`,
};

const CHARACTER_VOICES: Readonly<Record<string, { voice: string; tone: string }>> = {
  moises: { voice: "onyx", tone: "Voz de hombre mayor, grave, pausada y humilde." },
  david: { voice: "ash", tone: "Voz de hombre joven, cálida y sincera." },
  ester: { voice: "coral", tone: "Voz de mujer joven, serena y valiente." },
  pablo: { voice: "echo", tone: "Voz de hombre maduro, firme y apasionada." },
  rut: { voice: "shimmer", tone: "Voz de mujer joven, dulce y decidida." },
  elias: { voice: "ballad", tone: "Voz de hombre cansado y profundo, que habla despacio." },
};

export function reelVoice(reel: Pick<FeedReel, "kind" | "voiceSlug" | "title">): ReelVoice {
  if (reel.kind === "story" || !reel.voiceSlug) return NARRATOR_VOICE;
  const voice = CHARACTER_VOICES[reel.voiceSlug];
  if (!voice) return NARRATOR_VOICE;
  return {
    voice: voice.voice,
    instructions:
      `Hablás en primera persona como ${reel.title}, un personaje de la Biblia, en español latinoamericano neutro. ` +
      `${voice.tone} ${READ_EXACTLY}`,
  };
}

/** Los personajes que tienen voz propia (el test pide una para cada personaje con monólogos). */
export const CHARACTER_VOICE_SLUGS: readonly string[] = Object.keys(CHARACTER_VOICES);

// Pesos del orden de los reels: lo que más quiere la comunidad sube, con
// bastante azar para que cada apertura sea distinta.
const WEIGHT_COMMUNITY = 2;
const WEIGHT_RANDOM = 1.5;
/** Con pocos ♥, el primero no tapa el azar (igual que los versículos). */
const COMMUNITY_SCALE_MIN = 20;

export type ReelRankInput = {
  pool: readonly FeedReel[];
  likedRefs: readonly string[];
  seenRefs: readonly string[];
  communityLikes: ReadonlyMap<string, number>;
  seed: number;
  count: number;
};

/**
 * Los próximos reels: no repite lo ya visto (cuando se vieron todos, vuelven
 * sin los últimos), alterna historia y personaje, y nunca pone dos veces el
 * mismo personaje en una tanda.
 */
export function rankReels({ communityLikes, count, likedRefs, pool, seed, seenRefs }: ReelRankInput): FeedReel[] {
  if (count <= 0 || pool.length === 0) return [];
  const random = seededRandom(seed ^ 0x5bd1e995);
  const seen = new Set(seenRefs);
  let candidates = pool.filter((reel) => !seen.has(reel.ref));
  if (candidates.length < count) {
    const recent = new Set(seenRefs.slice(-FEED_RECENT_GUARD));
    candidates = pool.filter((reel) => !recent.has(reel.ref));
    if (candidates.length < count) candidates = [...pool];
  }
  const communityScale = Math.log1p(Math.max(COMMUNITY_SCALE_MIN, ...communityLikes.values()));
  const liked = new Set(likedRefs);
  const scored = candidates
    .map((reel) => ({
      reel,
      score:
        (WEIGHT_COMMUNITY * Math.log1p(communityLikes.get(reel.ref) ?? 0)) / communityScale +
        WEIGHT_RANDOM * random() -
        (liked.has(reel.ref) ? WEIGHT_COMMUNITY : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ reel }) => reel);

  const picked: FeedReel[] = [];
  const usedSlugs = new Set<string>();
  // La tanda arranca con historia o personaje según la semilla, y después alterna.
  let want: FeedReelKind = random() < 0.5 ? "story" : "character";
  while (picked.length < count) {
    const open = scored.filter((reel) => !picked.includes(reel));
    if (open.length === 0) break;
    const fresh = open.filter((reel) => reel.kind !== "character" || !usedSlugs.has(reel.voiceSlug ?? ""));
    const next = fresh.find((reel) => reel.kind === want) ?? fresh[0] ?? open[0];
    picked.push(next);
    if (next.kind === "character" && next.voiceSlug) usedSlugs.add(next.voiceSlug);
    want = next.kind === "story" ? "character" : "story";
  }
  return picked;
}
