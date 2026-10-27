import topicVersesJson from "../docs/content/versiculos-por-tema.json";
import { devotionalCatalog } from "./devotionalCatalog";
import { FEED_PAGE_SIZE } from "./verseFeedLimits";

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos): un scroll
 * vertical sin fin, un versículo por pantalla. No genera nada (regla dura #4):
 * el texto sale de la Biblia cargada (RV1909 por defecto) y la lista de citas
 * es curada a mano — los versículos por tema (`docs/content/`) más el pasaje
 * de cada uno de los 366 devocionales. Acá vive todo lo que no toca la base:
 * el catálogo y el orden, para poder testearlo sin Convex.
 */

export type FeedPassage = {
  /** Cita tal cual se muestra y se guarda: "Filipenses 4:6-7". */
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  /** Último versículo del rango, o null si es uno solo. */
  endVerse: number | null;
  /** Ids de tema (`versiculos-por-tema.json`); vacío si solo viene de un devocional. */
  topics: readonly string[];
  imageUrl: string;
  imageAlt: string;
};

type TopicData = { id: string; name: string; verses: readonly string[] };

const REF = /^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/;

/** "Salmos 23:1" o "Filipenses 4:6-7" (rango dentro del capítulo). null si no se entiende. */
export function parseFeedRef(ref: string): Pick<FeedPassage, "book" | "chapter" | "verse" | "endVerse"> | null {
  const match = REF.exec(ref.trim());
  if (!match) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const endVerse = match[4] === undefined ? null : Number(match[4]);
  if (chapter < 1 || verse < 1 || (endVerse !== null && endVerse <= verse)) return null;
  return { book: match[1], chapter, verse, endVerse };
}

const TOPICS = (topicVersesJson as { topics: TopicData[] }).topics;

/** Nombre visible de un tema ("Esperanza"); el id si no existe. */
export const FEED_TOPIC_NAMES: ReadonlyMap<string, string> = new Map(TOPICS.map((topic) => [topic.id, topic.name]));

// Las fotos son las de los devocionales: el feed no trae imágenes propias.
const IMAGES = [...new Map(devotionalCatalog.map((item) => [item.imageUrl, item])).values()].map(
  ({ imageAlt, imageUrl }) => ({ imageAlt, imageUrl }),
);

function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** El catálogo del feed, sin citas repetidas. Cada cita junta todos los temas en los que aparece. */
export function buildFeedPool(topics: readonly TopicData[] = TOPICS, devotionalRefs = devotionalCatalog): FeedPassage[] {
  const pool = new Map<string, FeedPassage>();
  const add = (ref: string, topic: string | null, image?: { imageUrl: string; imageAlt: string }) => {
    const parsed = parseFeedRef(ref);
    if (!parsed) return;
    const existing = pool.get(ref);
    if (existing) {
      if (topic && !existing.topics.includes(topic)) pool.set(ref, { ...existing, topics: [...existing.topics, topic] });
      return;
    }
    const picture = image ?? IMAGES[hashOf(ref) % IMAGES.length];
    pool.set(ref, { ref, ...parsed, topics: topic ? [topic] : [], imageUrl: picture.imageUrl, imageAlt: picture.imageAlt });
  };
  for (const item of devotionalRefs) add(item.verseRef, null, item);
  for (const topic of topics) for (const ref of topic.verses) add(ref, topic.id);
  return [...pool.values()];
}

export const FEED_POOL: readonly FeedPassage[] = buildFeedPool();
const POOL_BY_REF = new Map(FEED_POOL.map((passage) => [passage.ref, passage]));

export function feedPassage(ref: string): FeedPassage | null {
  return POOL_BY_REF.get(ref) ?? null;
}

export { FEED_PAGE_SIZE, FEED_SEEN_MAX } from "./verseFeedLimits";
/** Cuando ya se vio todo, se vuelve a empezar sin repetir las últimas. */
export const FEED_RECENT_GUARD = 24;

// Pesos del orden. Lo que te gusta pesa más que lo que le gusta a todos, y el
// azar alcanza para que el feed nunca sea el mismo dos veces.
const WEIGHT_AFFINITY = 3;
const WEIGHT_COMMUNITY = 2;
const WEIGHT_RANDOM = 1.5;
/** Cada cuántos lugares entra uno al azar, para descubrir temas nuevos. */
const EXPLORE_EVERY = 4;
/** Máximo de versículos del mismo tema principal en una página. */
const MAX_PER_TOPIC = 2;

/** Generador determinístico (mulberry32): misma semilla, mismo orden. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cuánto le gusta cada tema a la persona: un punto por cada versículo que marcó. */
export function topicAffinity(likedRefs: readonly string[], pool: ReadonlyMap<string, FeedPassage> = POOL_BY_REF) {
  const affinity = new Map<string, number>();
  for (const ref of likedRefs) {
    for (const topic of pool.get(ref)?.topics ?? []) affinity.set(topic, (affinity.get(topic) ?? 0) + 1);
  }
  return affinity;
}

export type FeedRankInput = {
  pool: readonly FeedPassage[];
  /** Lo que la persona marcó con ♥ (sus temas suben). */
  likedRefs: readonly string[];
  /** Lo que ya vio, del más viejo al más nuevo (no se repite). */
  seenRefs: readonly string[];
  /** ♥ de toda la comunidad por cita (lo más querido sube). */
  communityLikes: ReadonlyMap<string, number>;
  seed: number;
  size?: number;
};

/**
 * La próxima página del feed. Puntaje = afinidad con tus temas + cariño de la
 * comunidad + azar; cada `EXPLORE_EVERY` lugares entra uno al azar puro y no
 * se juntan más de `MAX_PER_TOPIC` del mismo tema. Si ya se vio todo el
 * catálogo, arranca otra vuelta sin las últimas vistas: el scroll no se acaba.
 */
export function rankFeedPage({ communityLikes, likedRefs, pool, seed, seenRefs, size = FEED_PAGE_SIZE }: FeedRankInput): FeedPassage[] {
  const random = seededRandom(seed);
  const seen = new Set(seenRefs);
  let candidates = pool.filter((passage) => !seen.has(passage.ref));
  if (candidates.length < size) {
    const recent = new Set(seenRefs.slice(-FEED_RECENT_GUARD));
    candidates = pool.filter((passage) => !recent.has(passage.ref));
  }

  const byRef = new Map(pool.map((passage) => [passage.ref, passage]));
  const affinity = topicAffinity(likedRefs, byRef);
  const maxAffinity = Math.max(1, ...affinity.values());
  const maxLikes = Math.max(1, ...communityLikes.values());
  const liked = new Set(likedRefs);

  const scored = candidates
    .map((passage) => {
      const topicScore = Math.max(0, ...passage.topics.map((topic) => affinity.get(topic) ?? 0)) / maxAffinity;
      const communityScore = Math.log1p(communityLikes.get(passage.ref) ?? 0) / Math.log1p(maxLikes);
      // Lo que ya marcaste no vuelve enseguida: ya lo tenés guardado.
      const penalty = liked.has(passage.ref) ? WEIGHT_AFFINITY : 0;
      return {
        passage,
        score: WEIGHT_AFFINITY * topicScore + WEIGHT_COMMUNITY * communityScore + WEIGHT_RANDOM * random() - penalty,
      };
    })
    .sort((a, b) => b.score - a.score);

  const page: FeedPassage[] = [];
  const perTopic = new Map<string, number>();
  const taken = new Set<string>();
  // Los pasajes que solo vienen de un devocional no tienen tema: no cuentan para el tope.
  const fits = (passage: FeedPassage) => {
    const topic = passage.topics[0];
    return topic === undefined || (perTopic.get(topic) ?? 0) < MAX_PER_TOPIC;
  };
  const take = (passage: FeedPassage) => {
    page.push(passage);
    taken.add(passage.ref);
    const topic = passage.topics[0];
    if (topic !== undefined) perTopic.set(topic, (perTopic.get(topic) ?? 0) + 1);
  };

  while (page.length < size && taken.size < scored.length) {
    const open = scored.filter(({ passage }) => !taken.has(passage.ref));
    const explore = (page.length + 1) % EXPLORE_EVERY === 0;
    const varied = open.filter(({ passage }) => fits(passage));
    const choices = varied.length > 0 ? varied : open;
    const next = explore ? choices[Math.floor(random() * choices.length)] : choices[0];
    take(next.passage);
  }
  return page;
}
