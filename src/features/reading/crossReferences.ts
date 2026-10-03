import crossReferencesJson from "../../../docs/content/referencias-cruzadas.json";
import { BIBLE_BOOKS, indexOfBook } from "../../lib/bibleBooks";

/**
 * Pasajes relacionados de un versículo (#187, N4). El índice es fijo y sale de
 * OpenBible.info (CC-BY), que parte del Treasury of Scripture Knowledge: no es
 * IA, así que la regla dura #4 no aplica. Acá solo hay referencias; el texto de
 * cada pasaje se lee de RV1909 como en el lector.
 *
 * Formato y regeneración: `scripts/generate-cross-references.mjs`.
 */
export type CrossReferenceData = {
  /** [libro 0–65][capítulo-1][versículo-1] → "b.c.v[-v|-c.v] …", de más a menos votado. */
  books: readonly (readonly (readonly string[])[])[];
};

export type CrossReference = {
  book: string;
  chapter: number;
  verse: number;
  /** Final del rango; ausente si es un solo versículo. */
  end?: { chapter: number; verse: number };
};

export type VerseRef = { book: string; chapter: number; verse: number };

export const CROSS_REFERENCE_ATTRIBUTION = "Referencias cruzadas: OpenBible.info (CC-BY), basadas en el Treasury of Scripture Knowledge.";

const DEFAULT_DATA: CrossReferenceData = crossReferencesJson;

const CODE = /^(\d+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/;

/** Una referencia del índice; null si está mal formada o fuera del canon. */
export function decodeCrossReference(code: string): CrossReference | null {
  const match = CODE.exec(code);
  if (!match) return null;
  const book = BIBLE_BOOKS[Number(match[1])];
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return null;
  if (match[5] === undefined) return { book: book.name, chapter, verse };

  const endChapter = match[4] === undefined ? chapter : Number(match[4]);
  const endVerse = Number(match[5]);
  const validEnd = endChapter <= book.chapters && (endChapter > chapter || (endChapter === chapter && endVerse > verse));
  return validEnd ? { book: book.name, chapter, verse, end: { chapter: endChapter, verse: endVerse } } : { book: book.name, chapter, verse };
}

/** Pasajes relacionados con un versículo, en orden de relevancia. */
export function crossReferencesFor(ref: VerseRef, data: CrossReferenceData = DEFAULT_DATA): CrossReference[] {
  const index = indexOfBook(ref.book);
  if (index < 0) return [];
  const raw = data.books[index]?.[ref.chapter - 1]?.[ref.verse - 1];
  if (!raw) return [];
  return raw
    .split(" ")
    .map(decodeCrossReference)
    .filter((item): item is CrossReference => item !== null);
}

export function hasCrossReferences(ref: VerseRef, data: CrossReferenceData = DEFAULT_DATA): boolean {
  return crossReferencesFor(ref, data).length > 0;
}

/** "Romanos 5:8", "1 Juan 4:9–10", "Génesis 1:1–2:3". */
export function formatCrossReference(ref: CrossReference): string {
  const start = `${ref.book} ${ref.chapter}:${ref.verse}`;
  if (!ref.end) return start;
  return ref.end.chapter === ref.chapter ? `${start}–${ref.end.verse}` : `${start}–${ref.end.chapter}:${ref.end.verse}`;
}

/**
 * Versículos de un pasaje dentro del capítulo donde empieza. Si el rango sigue
 * en otro capítulo, se muestra hasta el final de este (tocar abre el lector).
 * Un versículo que la versión no tiene simplemente no aparece: nunca se
 * inventa texto.
 */
export function passageVerses<T extends { verse: number }>(ref: CrossReference, chapterVerses: readonly T[]): T[] {
  const last = !ref.end ? ref.verse : ref.end.chapter === ref.chapter ? ref.end.verse : Number.POSITIVE_INFINITY;
  return chapterVerses.filter((item) => item.verse >= ref.verse && item.verse <= last);
}
