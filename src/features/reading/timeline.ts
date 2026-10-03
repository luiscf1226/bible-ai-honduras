import { findTextStoryById } from "../../../convex/textStoriesCatalog";
import { voiceCharacters } from "../../../convex/voicesCatalog";
import timelineJson from "../../../docs/content/linea-del-tiempo.json";
import { chaptersFor } from "../../lib/bibleBooks";

/**
 * Línea del tiempo de la Biblia (#201). Los datos viven en
 * `docs/content/linea-del-tiempo.json`, curados a mano y sin IA: dónde cae un
 * libro es un dato, no una opinión generada, así que la regla dura #4 no aplica
 * y no cuesta nada por consulta. El JSON va en el bundle: funciona sin conexión.
 *
 * Personajes: solo los del catálogo de Voces, que son todos humanos (regla
 * dura #2). Jesús aparece como época, nunca como personaje.
 *
 * Historias: las del catálogo en texto (gratis). Las ilustradas pasan por
 * `stories.create` y su cuota (regla dura #3), así que la línea no las abre
 * directo; las cinco tienen su versión en texto en la misma época.
 */

export type TimelineBook = {
  book: string;
  /** Sin from/to, el libro entero cae en esta época. */
  from?: number;
  to?: number;
  /** Aclaración cuando la ubicación no es obvia o se discute (Job, Joel, Salmos). */
  note?: string;
};

export type TimelineEra = {
  id: string;
  name: string;
  /** Solo donde hay consenso amplio; siempre aproximado. null = solo el orden. */
  years: string | null;
  summary: string;
  books: readonly TimelineBook[];
  voices: readonly string[];
  stories: readonly string[];
};

type TimelineFile = { version: number; eras: TimelineEra[] };

function assertValidEra(era: unknown, index: number): asserts era is TimelineEra {
  if (typeof era !== "object" || era === null) throw new Error(`linea-del-tiempo[${index}] debe ser un objeto`);
  const candidate = era as Partial<TimelineEra>;
  if (typeof candidate.id !== "string" || !/^[a-z0-9-]+$/.test(candidate.id)) {
    throw new Error(`linea-del-tiempo[${index}] id inválido`);
  }
  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    throw new Error(`linea-del-tiempo[${index}] necesita name`);
  }
  if (candidate.years !== null && typeof candidate.years !== "string") {
    throw new Error(`linea-del-tiempo[${index}] years inválido`);
  }
  if (typeof candidate.summary !== "string" || candidate.summary.length === 0) {
    throw new Error(`linea-del-tiempo[${index}] necesita summary`);
  }
  if (!Array.isArray(candidate.books) || !Array.isArray(candidate.voices) || !Array.isArray(candidate.stories)) {
    throw new Error(`linea-del-tiempo[${index}] necesita books, voices y stories`);
  }
  for (const book of candidate.books) {
    if (typeof book?.book !== "string") throw new Error(`linea-del-tiempo[${index}] libro inválido`);
    if ((book.from === undefined) !== (book.to === undefined)) {
      throw new Error(`linea-del-tiempo[${index}] ${book.book}: from y to van juntos`);
    }
  }
}

function loadTimeline(raw: unknown): readonly TimelineEra[] {
  const file = raw as Partial<TimelineFile>;
  if (!Array.isArray(file?.eras) || file.eras.length === 0) {
    throw new Error("linea-del-tiempo.json necesita eras[]");
  }
  const seen = new Set<string>();
  for (const [index, era] of file.eras.entries()) {
    assertValidEra(era, index);
    if (seen.has(era.id)) throw new Error(`linea-del-tiempo id duplicado: ${era.id}`);
    seen.add(era.id);
  }
  return file.eras;
}

export const TIMELINE_ERAS: readonly TimelineEra[] = loadTimeline(timelineJson);

/** Primer y último capítulo de un libro dentro de una época. */
export function bookRange(entry: TimelineBook): { from: number; to: number } {
  return { from: entry.from ?? 1, to: entry.to ?? chaptersFor(entry.book) };
}

/** "Génesis 12–50", "1 Reyes 12–22", "2 Crónicas 36" o solo "Job" si va entero. */
export function timelineBookLabel(entry: TimelineBook): string {
  if (entry.from === undefined || entry.to === undefined) return entry.book;
  return entry.from === entry.to ? `${entry.book} ${entry.from}` : `${entry.book} ${entry.from}–${entry.to}`;
}

/**
 * Época en la que cae un capítulo. Un libro que abarca varias épocas se
 * resuelve por capítulo (Génesis 11 → orígenes, Génesis 12 → patriarcas).
 */
export function eraForChapter(book: string, chapter: number): TimelineEra | null {
  return (
    TIMELINE_ERAS.find((era) =>
      era.books.some((entry) => {
        if (entry.book !== book) return false;
        const { from, to } = bookRange(entry);
        return chapter >= from && chapter <= to;
      }),
    ) ?? null
  );
}

/** El parámetro `epoca` de la ruta, si es una época que existe. */
export function eraFromParam(param: string | string[] | undefined): TimelineEra | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value) return null;
  return TIMELINE_ERAS.find((era) => era.id === value) ?? null;
}

/** Encabezado de la tarjeta: "ÉPOCA 5 DE 10 · C. 1050–930 A.C. (APROX.)". */
export function eraOverline(era: TimelineEra): string {
  const position = `ÉPOCA ${TIMELINE_ERAS.indexOf(era) + 1} DE ${TIMELINE_ERAS.length}`;
  return (era.years ? `${position} · ${era.years} (aprox.)` : position).toUpperCase();
}

export type TimelineVoice = { slug: string; name: string; tag: string };
export type TimelineStory = { id: string; title: string; reference: string };

export function eraVoices(era: TimelineEra): TimelineVoice[] {
  return era.voices.flatMap((slug) => {
    const character = voiceCharacters.find((item) => item.slug === slug);
    return character ? [{ slug, name: character.name, tag: character.tag }] : [];
  });
}

export function eraStories(era: TimelineEra): TimelineStory[] {
  return era.stories.flatMap((id) => {
    const story = findTextStoryById(id);
    return story ? [{ id, title: story.title, reference: story.reference }] : [];
  });
}
