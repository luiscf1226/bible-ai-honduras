import topicVersesJson from "../../../docs/content/versiculos-por-tema.json";
import { BIBLE_BOOKS } from "../../lib/bibleBooks";
import { normalizeText } from "../../lib/normalizeText";
import type { Feeling } from "../feelings/feelings";
import type { CrossReference } from "./crossReferences";

/**
 * Versículos por tema o sentimiento, sin IA. La lista es fija y curada a mano
 * en `docs/content/versiculos-por-tema.json`: acá solo hay citas, el texto se
 * lee de RV1909 como en el lector (igual que los pasajes relacionados, #187).
 * No genera nada, así que no gasta cuota ni necesita el RAG (regla dura #4).
 *
 * Los temas de tipo "sentimiento" se llaman igual que los chips de Sentir,
 * para poder llegar desde ahí con el mismo nombre.
 */
export type TopicKind = "sentimiento" | "tema";

export type VerseTopicData = {
  id: string;
  name: string;
  kind: TopicKind;
  /** Sin tildes ni mayúsculas: otras palabras con las que alguien buscaría el tema. */
  keywords: readonly string[];
  /** "Filipenses 4:6-7": un versículo o un rango dentro del mismo capítulo. */
  verses: readonly string[];
};

export type VerseTopic = Omit<VerseTopicData, "verses"> & { verses: CrossReference[] };

const REF = /^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/;

/** Una cita del catálogo; null si está mal escrita o fuera del canon. */
export function parseTopicVerse(ref: string): CrossReference | null {
  const match = REF.exec(ref.trim());
  if (!match) return null;
  const book = BIBLE_BOOKS.find((item) => item.name === match[1]);
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return null;
  if (match[4] === undefined) return { book: book.name, chapter, verse };
  const endVerse = Number(match[4]);
  if (endVerse <= verse) return null;
  return { book: book.name, chapter, verse, end: { chapter, verse: endVerse } };
}

export function buildTopics(data: readonly VerseTopicData[]): VerseTopic[] {
  return data.map((topic) => ({
    ...topic,
    verses: topic.verses.map(parseTopicVerse).filter((item): item is CrossReference => item !== null),
  }));
}

export const VERSE_TOPICS: readonly VerseTopic[] = buildTopics(topicVersesJson.topics as VerseTopicData[]);

export function topicById(id: string | null | undefined, topics: readonly VerseTopic[] = VERSE_TOPICS): VerseTopic | null {
  return topics.find((topic) => topic.id === id) ?? null;
}

/** El tema que corresponde a un chip de Sentir. */
export function topicForFeeling(feeling: Feeling, topics: readonly VerseTopic[] = VERSE_TOPICS): VerseTopic | null {
  return topics.find((topic) => topic.kind === "sentimiento" && topic.name === feeling) ?? null;
}

/**
 * Temas que coinciden con lo que la persona escribió, sin importar tildes ni
 * mayúsculas: primero los que empiezan por el nombre, después los que lo
 * contienen y al final los que coinciden por una palabra clave. Vacío → todos.
 */
export function searchTopics(query: string, topics: readonly VerseTopic[] = VERSE_TOPICS): VerseTopic[] {
  const needle = normalizeText(query);
  if (!needle) return [...topics];

  // "tengo miedo" o "estoy preocupado": cada palabra cuenta por separado.
  const words = needle.split(/\s+/).filter((word) => word.length >= 3);
  const hitsWord = (candidate: string) =>
    candidate.startsWith(needle) || words.some((word) => candidate === word || (word.length >= 4 && candidate.startsWith(word)));

  const rank = (topic: VerseTopic): number => {
    const name = normalizeText(topic.name);
    if (name.startsWith(needle) || name.split(" ").some((word) => word.startsWith(needle))) return 0;
    if (name.includes(needle) || name.split(" ").some(hitsWord)) return 1;
    if (topic.keywords.some((keyword) => (keyword.includes(" ") ? needle.includes(keyword) || keyword.startsWith(needle) : hitsWord(keyword)))) return 2;
    return -1;
  };

  return topics
    .map((topic, index) => ({ topic, index, rank: rank(topic) }))
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.topic);
}

export function topicCountLabel(count: number): string {
  return count === 1 ? "1 VERSÍCULO" : `${count} VERSÍCULOS`;
}
