/**
 * "Tu año en la Palabra" (#183): reglas puras, sin funciones de Convex, para
 * que las compartan el backend (`convex/yearInWord.ts`), la app y los tests.
 *
 * Todas las fechas son llaves YYYY-MM-DD en el calendario de Honduras, igual
 * que el devocional y los planes.
 */

/**
 * Temporada en que la entrada aparece en Mi espacio: del 1 de diciembre al 31
 * de enero. Diciembre cierra el año; enero deja un mes para verlo después de
 * las fiestas. Fuera de la temporada la pantalla se puede abrir igual por ruta
 * (`/tu-ano`), pero no se ofrece.
 */
export function isYearInWordSeason(today: string): boolean {
  const month = Number(today.slice(5, 7));
  return month === 12 || month === 1;
}

/**
 * Año que resume la pantalla para la fecha dada: en enero es el año que acaba
 * de terminar; el resto del año, el año en curso.
 */
export function yearInWordYear(today: string): number {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) === 1 ? year - 1 : year;
}

/** Límites aceptados para `year`: nada de años absurdos por argumento. */
export const YEAR_IN_WORD_MIN_YEAR = 2025;
export const YEAR_IN_WORD_MAX_YEAR = 2100;

export function isValidYearInWordYear(year: number): boolean {
  return Number.isInteger(year) && year >= YEAR_IN_WORD_MIN_YEAR && year <= YEAR_IN_WORD_MAX_YEAR;
}

/** Lo que la pantalla necesita del versículo más subrayado. */
export type TopHighlight = {
  book: string;
  chapter: number;
  verse: number;
  /** Cuántos versículos subrayó en ese capítulo durante el año. */
  chapterCount: number;
};

export type YearInWordCounts = {
  year: number;
  chaptersRead: number;
  planDays: number;
  savedVerses: number;
  topHighlight: TopHighlight | null;
};

export type YearInWordInput = {
  /** Una fila por capítulo con la fecha (Honduras) de la última vez que se abrió. */
  recents: Array<{ book: string; chapter: number; day: string }>;
  /** Fecha (Honduras) de cada día de plan cumplido. */
  planDays: string[];
  /** Fecha (Honduras) de cada versículo guardado. */
  bookmarks: string[];
  highlights: Array<{ book: string; chapter: number; verse: number; day: string; updatedAt: number }>;
};

/**
 * Cuenta el año. "El versículo más subrayado": cada versículo se subraya una
 * sola vez (cambiar de color parchea la fila), así que lo que se puede contar
 * es el capítulo donde más subrayó. De ese capítulo se muestra el primer
 * versículo subrayado en orden de lectura. Empate entre capítulos → el que
 * tocó más recientemente.
 */
export function countYearInWord(input: YearInWordInput, year: number): YearInWordCounts {
  const prefix = `${year}-`;
  const inYear = (day: string) => day.startsWith(prefix);

  const chapters = new Set(input.recents.filter((row) => inYear(row.day)).map((row) => `${row.book}|${row.chapter}`));

  const byChapter = new Map<string, { book: string; chapter: number; verses: number[]; last: number }>();
  for (const row of input.highlights) {
    if (!inYear(row.day)) continue;
    const key = `${row.book}|${row.chapter}`;
    const entry = byChapter.get(key) ?? { book: row.book, chapter: row.chapter, verses: [], last: 0 };
    entry.verses.push(row.verse);
    entry.last = Math.max(entry.last, row.updatedAt);
    byChapter.set(key, entry);
  }
  let top: { book: string; chapter: number; verses: number[]; last: number } | null = null;
  for (const entry of byChapter.values()) {
    if (
      top === null ||
      entry.verses.length > top.verses.length ||
      (entry.verses.length === top.verses.length && entry.last > top.last)
    ) {
      top = entry;
    }
  }

  return {
    year,
    chaptersRead: chapters.size,
    planDays: input.planDays.filter(inYear).length,
    savedVerses: input.bookmarks.filter(inYear).length,
    topHighlight: top
      ? { book: top.book, chapter: top.chapter, verse: Math.min(...top.verses), chapterCount: top.verses.length }
      : null,
  };
}
