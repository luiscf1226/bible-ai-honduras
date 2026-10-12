import { ConvexError } from "convex/values";

/**
 * Notas de prédica (#232): topes, tipos y validación, sin funciones de Convex.
 * Vive aparte de `sermonNotes.ts` para que el teléfono pueda usar los mismos
 * topes (`maxLength`) sin importar un archivo de funciones del backend.
 */

/** Topes por campo, validados en el servidor (el teléfono los usa como `maxLength`). */
export const SERMON_NOTE_LIMITS = {
  title: 120,
  church: 80,
  preacher: 80,
  notes: 5000,
  takeaway: 200,
  passages: 12,
} as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export type SermonPassage = { book: string; chapter: number; verse?: number };

export type SermonNoteInput = {
  clientId: string;
  date: string;
  church?: string;
  preacher?: string;
  title: string;
  passages: SermonPassage[];
  notes: string;
  takeaway: string;
};

function cleanText(value: string | undefined, field: string, max: number): string {
  const text = (value ?? "").trim();
  if (text.length > max) {
    throw new ConvexError(`${field} puede tener hasta ${max} caracteres`);
  }
  return text;
}

/**
 * Valida y limpia lo que llega del teléfono. Pura (sin `ctx`) para poder
 * probarla sola. Una nota necesita al menos título, un pasaje o algo escrito:
 * una nota vacía no se guarda.
 */
export function cleanSermonNote(input: SermonNoteInput) {
  if (!CLIENT_ID_PATTERN.test(input.clientId)) {
    throw new ConvexError("Nota sin identificador válido");
  }
  if (!DATE_PATTERN.test(input.date)) {
    throw new ConvexError("La fecha tiene que ser AAAA-MM-DD");
  }
  if (input.passages.length > SERMON_NOTE_LIMITS.passages) {
    throw new ConvexError(`Una nota puede tener hasta ${SERMON_NOTE_LIMITS.passages} pasajes`);
  }
  const passages = input.passages.map((passage) => {
    const book = passage.book.trim();
    if (book.length === 0 || book.length > 40 || !Number.isInteger(passage.chapter) || passage.chapter < 1) {
      throw new ConvexError("Pasaje inválido");
    }
    if (passage.verse !== undefined && (!Number.isInteger(passage.verse) || passage.verse < 1)) {
      throw new ConvexError("Pasaje inválido");
    }
    return passage.verse === undefined ? { book, chapter: passage.chapter } : { book, chapter: passage.chapter, verse: passage.verse };
  });
  const note = {
    clientId: input.clientId,
    date: input.date,
    church: cleanText(input.church, "La iglesia", SERMON_NOTE_LIMITS.church),
    preacher: cleanText(input.preacher, "El predicador", SERMON_NOTE_LIMITS.preacher),
    title: cleanText(input.title, "El título", SERMON_NOTE_LIMITS.title),
    passages,
    notes: cleanText(input.notes, "Las notas", SERMON_NOTE_LIMITS.notes),
    takeaway: cleanText(input.takeaway, "«¿Qué me llevo?»", SERMON_NOTE_LIMITS.takeaway),
  };
  if (note.title.length === 0 && note.passages.length === 0 && note.notes.length === 0 && note.takeaway.length === 0) {
    throw new ConvexError("La nota está vacía");
  }
  return note;
}
