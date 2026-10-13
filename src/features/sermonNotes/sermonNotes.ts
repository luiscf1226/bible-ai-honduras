import type { SermonNoteInput, SermonPassage } from "../../../convex/sermonNotesCore";
import { normalizeText } from "../../lib/normalizeText";

/**
 * Notas de prédica (#232, Parte 2): lógica pura de la lista y el editor. Nada
 * de esto pasa por la IA (regla dura #4): ordenar, buscar y armar el texto
 * para compartir es todo local.
 */

export type { SermonNoteInput, SermonPassage };

/** Lo que la pantalla necesita de una nota (del servidor o de la cola sin conexión). */
export type SermonNote = SermonNoteInput & { createdAt?: number; updatedAt?: number; pending?: boolean };

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

/** Hoy en Honduras, `YYYY-MM-DD`: la fecha por defecto de una nota nueva. */
export function sermonToday(now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HONDURAS_TIME_ZONE }).format(new Date(now));
}

/**
 * Identificador de la nota, puesto en el teléfono (la cola sin conexión la
 * reenvía con el mismo y el servidor no la duplica). No es secreto: solo
 * tiene que no repetirse entre las notas de una persona.
 */
export function newSermonClientId(now = Date.now(), random: () => number = Math.random): string {
  const rand = Array.from({ length: 12 }, () => Math.floor(random() * 36).toString(36)).join("");
  return `sn-${now.toString(36)}-${rand}`;
}

/** Nota vacía con la fecha de hoy y la iglesia y el predicador de la última nota. */
export function emptySermonNote(params: { clientId: string; today: string; lastUsed?: { church: string; preacher: string } }): SermonNoteInput {
  return {
    clientId: params.clientId,
    date: params.today,
    church: params.lastUsed?.church ?? "",
    preacher: params.lastUsed?.preacher ?? "",
    title: "",
    passages: [],
    notes: "",
    takeaway: "",
  };
}

/** Lo que se manda al servidor: solo los campos del contrato, sin `pending` ni fechas. */
export function toSermonInput(note: SermonNote): SermonNoteInput {
  return {
    clientId: note.clientId,
    date: note.date,
    church: note.church ?? "",
    preacher: note.preacher ?? "",
    title: note.title,
    passages: note.passages.map((passage) =>
      passage.verse === undefined ? { book: passage.book, chapter: passage.chapter } : { book: passage.book, chapter: passage.chapter, verse: passage.verse },
    ),
    notes: note.notes,
    takeaway: note.takeaway,
  };
}

/** Sin título, pasajes ni texto: no se guarda (el servidor la rechazaría). */
export function isEmptySermonNote(note: SermonNoteInput): boolean {
  return note.title.trim() === "" && note.passages.length === 0 && note.notes.trim() === "" && note.takeaway.trim() === "";
}

/** "Juan 3" o "Juan 3:16". */
export function sermonPassageLabel(passage: SermonPassage): string {
  return passage.verse === undefined ? `${passage.book} ${passage.chapter}` : `${passage.book} ${passage.chapter}:${passage.verse}`;
}

const samePassage = (a: SermonPassage, b: SermonPassage) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;

/** Suma un pasaje si no estaba (se puede agregar el mismo dos veces sin querer). */
export function addSermonPassage(passages: readonly SermonPassage[], passage: SermonPassage, max: number): SermonPassage[] {
  if (passages.some((item) => samePassage(item, passage)) || passages.length >= max) return [...passages];
  return [...passages, passage];
}

export function removeSermonPassage(passages: readonly SermonPassage[], passage: SermonPassage): SermonPassage[] {
  return passages.filter((item) => !samePassage(item, passage));
}

/** La iglesia y el predicador de la nota más reciente que los tenga (se recuerdan). */
export function lastUsedChurchAndPreacher(notes: readonly SermonNote[]): { church: string; preacher: string } {
  const latest = [...notes].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return {
    church: latest.find((note) => (note.church ?? "").trim() !== "")?.church?.trim() ?? "",
    preacher: latest.find((note) => (note.preacher ?? "").trim() !== "")?.preacher?.trim() ?? "",
  };
}

/** Búsqueda por título, predicador o pasaje, sin tildes ni mayúsculas. */
export function filterSermonNotes<T extends SermonNote>(notes: readonly T[], query: string): T[] {
  const needle = normalizeText(query.trim());
  if (needle === "") return [...notes];
  return notes.filter((note) => {
    const haystack = [note.title, note.preacher ?? "", ...note.passages.map(sermonPassageLabel)].map(normalizeText).join(" · ");
    return haystack.includes(needle);
  });
}

/** "domingo 11 de octubre de 2026". La fecha se toma como día de calendario, sin corrimiento de zona. */
export function sermonDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12));
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", timeZone: "UTC", weekday: "long", year: "numeric" }).format(date);
}

/** Título para la lista: el que escribió la persona, o el primer pasaje, o "Prédica del …". */
export function sermonDisplayTitle(note: SermonNoteInput): string {
  if (note.title.trim()) return note.title.trim();
  if (note.passages[0]) return sermonPassageLabel(note.passages[0]);
  return `Prédica del ${sermonDateLabel(note.date)}`;
}

/** "Iglesia Bethel · Pastor Juan" (lo que haya). */
export function sermonByline(note: SermonNoteInput): string {
  return [note.preacher?.trim(), note.church?.trim()].filter((part): part is string => Boolean(part)).join(" · ");
}

/**
 * Texto para WhatsApp (#232): título, fecha, predicador, pasajes y "¿Qué me
 * llevo?". Las notas libres **solo** si la persona lo marcó (`includeNotes`).
 */
export function buildSermonShareText(note: SermonNoteInput, options: { includeNotes: boolean }): string {
  const lines = [sermonDisplayTitle(note), sermonDateLabel(note.date)];
  const byline = sermonByline(note);
  if (byline) lines.push(byline);
  if (note.passages.length > 0) lines.push("", `Pasajes: ${note.passages.map(sermonPassageLabel).join(", ")}`);
  if (note.takeaway.trim()) lines.push("", `Me llevo: ${note.takeaway.trim()}`);
  if (options.includeNotes && note.notes.trim()) lines.push("", note.notes.trim());
  return lines.join("\n");
}

/** Corre una fecha `YYYY-MM-DD` unos días (el ‹ › de la fecha en el editor). Nunca pasa de `max`. */
export function shiftDateKey(dateKey: string, days: number, max?: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + days, 12)).toISOString().slice(0, 10);
  return max !== undefined && next > max ? max : next;
}
