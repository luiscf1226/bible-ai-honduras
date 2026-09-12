import { BIBLE_BOOKS, chaptersFor, indexOfBook } from "../../lib/bibleBooks";

export type ChapterRef = {
  book: string;
  chapter: number;
};

/**
 * Navegación continua del lector (#113): de Génesis 1 a Apocalipsis 22 sin
 * volver al menú. En los bordes de libro salta al siguiente/anterior
 * (Gn 50 → Ex 1, Ex 1 → Gn 50); en los bordes del canon devuelve null y la
 * pantalla deshabilita el botón.
 */
export function nextChapter(ref: ChapterRef): ChapterRef | null {
  const index = indexOfBook(ref.book);
  if (index < 0 || !isValidChapter(ref)) {
    return null;
  }

  if (ref.chapter < chaptersFor(ref.book)) {
    return { book: ref.book, chapter: ref.chapter + 1 };
  }

  const nextBook = BIBLE_BOOKS[index + 1];
  return nextBook ? { book: nextBook.name, chapter: 1 } : null;
}

export function previousChapter(ref: ChapterRef): ChapterRef | null {
  const index = indexOfBook(ref.book);
  if (index < 0 || !isValidChapter(ref)) {
    return null;
  }

  if (ref.chapter > 1) {
    return { book: ref.book, chapter: ref.chapter - 1 };
  }

  const previousBook = BIBLE_BOOKS[index - 1];
  return previousBook ? { book: previousBook.name, chapter: previousBook.chapters } : null;
}

export function isValidChapter(ref: ChapterRef): boolean {
  const total = chaptersFor(ref.book);
  return total > 0 && Number.isInteger(ref.chapter) && ref.chapter >= 1 && ref.chapter <= total;
}

/**
 * Normaliza lo que llega por la URL (`/leer/Juan/3`). Los params de expo-router
 * son strings y pueden venir de un deep link cualquiera: si el libro no existe
 * o el capítulo se sale del rango, el lector muestra el estado de error en vez
 * de consultar Convex con basura.
 */
export function parseChapterParams(params: {
  book?: string | string[];
  chapter?: string | string[];
}): ChapterRef | null {
  const book = firstParam(params.book);
  const chapter = Number(firstParam(params.chapter));
  if (!book || !Number.isFinite(chapter)) {
    return null;
  }
  const ref = { book: decodeURIComponent(book), chapter };
  return isValidChapter(ref) ? ref : null;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
