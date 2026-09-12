import { BIBLE_BOOKS, chaptersFor, type BibleBook, type Testament } from "../../lib/bibleBooks";
import { parseVerseRef } from "../../lib/parseVerseRef";

/**
 * Buscador de pasajes (#112). Todo acá es puro y sincrónico a propósito: el
 * filtro de los 66 libros corre en el cliente sobre un array en memoria, sin
 * ir al servidor, que es lo que exige el criterio de "<100 ms" del issue.
 */

/** minúsculas + sin tildes, conservando espacios. */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** normalizeText además sin espacios: "1 co" y "1co" son la misma cosa. */
export function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}

/**
 * ¿Este libro entra en el filtro? Se acepta por nombre (subcadena, para que
 * "salm" y "mos" encuentren Salmos) o por abreviatura (prefijo compacto, para
 * que "1co" encuentre 1 Corintios aunque el nombre tenga espacio).
 */
export function matchesBookQuery(book: BibleBook, query: string): boolean {
  const normalized = normalizeText(query);
  if (normalized.length === 0) {
    return true;
  }
  const compact = compactText(query);
  if (normalizeText(book.name).includes(normalized)) {
    return true;
  }
  if (compactText(book.name).startsWith(compact)) {
    return true;
  }
  return book.abbreviations.some((abbreviation) => abbreviation.startsWith(compact));
}

export type BookSection = {
  testament: Testament;
  title: string;
  books: BibleBook[];
};

const SECTION_TITLES: Record<Testament, string> = {
  antiguo: "Antiguo Testamento",
  nuevo: "Nuevo Testamento",
};

/**
 * Libros filtrados y agrupados por testamento. Las secciones vacías no se
 * devuelven: buscar "juan" no debe dejar un encabezado "Antiguo Testamento"
 * colgando sin nada abajo.
 */
export function searchBookSections(query: string): BookSection[] {
  const matches = BIBLE_BOOKS.filter((book) => matchesBookQuery(book, query));
  const testaments: Testament[] = ["antiguo", "nuevo"];

  return testaments
    .map((testament) => ({
      testament,
      title: SECTION_TITLES[testament],
      books: matches.filter((book) => book.testament === testament),
    }))
    .filter((section) => section.books.length > 0);
}

/**
 * Resuelve el nombre canónico de un libro a partir de lo que escribió la
 * persona. A diferencia del filtro, acá el match es exacto (nombre completo o
 * abreviatura completa): un salto por referencia no puede adivinar.
 */
export function resolveBookName(input: string): string | null {
  const normalized = normalizeText(input);
  const compact = compactText(input);
  if (normalized.length === 0) {
    return null;
  }

  const byName = BIBLE_BOOKS.find(
    (book) => normalizeText(book.name) === normalized || compactText(book.name) === compact,
  );
  if (byName) {
    return byName.name;
  }

  const byAbbreviation = BIBLE_BOOKS.find((book) => book.abbreviations.includes(compact));
  return byAbbreviation?.name ?? null;
}

export type PassageQuery = {
  book: string;
  chapter: number;
  /** `undefined` cuando la persona escribió solo "Juan 3". */
  verse?: number;
};

/**
 * "Juan 3:16" → { book: "Juan", chapter: 3, verse: 16 }. También acepta
 * abreviaturas ("jn 3:16") y capítulo suelto ("sal 23").
 *
 * El parseo de "Libro cap:ver" no se reimplementa: sale de
 * `src/lib/parseVerseRef.ts`, que ya existe y está testeado (#112). Acá solo
 * se agrega la resolución del nombre del libro y el caso sin versículo.
 *
 * Devuelve null si el libro no existe o si el capítulo se sale del libro
 * ("Juan 99" no abre nada).
 */
export function parsePassageQuery(input: string): PassageQuery | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = parseVerseRef(trimmed);
  if (parsed) {
    const book = resolveBookName(parsed.book);
    if (!book || !isChapterInBook(book, parsed.chapter) || parsed.verse < 1) {
      return null;
    }
    return { book, chapter: parsed.chapter, verse: parsed.verse };
  }

  const chapterOnly = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (!chapterOnly) {
    return null;
  }
  const book = resolveBookName(chapterOnly[1]);
  const chapter = Number(chapterOnly[2]);
  if (!book || !isChapterInBook(book, chapter)) {
    return null;
  }
  return { book, chapter };
}

export function isChapterInBook(book: string, chapter: number): boolean {
  const total = chaptersFor(book);
  return total > 0 && Number.isInteger(chapter) && chapter >= 1 && chapter <= total;
}

/** "Juan 3:16" / "Juan 3" — la etiqueta que ve la persona. */
export function formatPassage(passage: PassageQuery): string {
  return passage.verse === undefined
    ? `${passage.book} ${passage.chapter}`
    : `${passage.book} ${passage.chapter}:${passage.verse}`;
}
