import { findBook } from "../../lib/bibleBooks";
import { parseVerseRef } from "../../lib/parseVerseRef";
import { tokens } from "../../theme/tokens";

/**
 * Un minuto de pausa (#203): partes puras, sin React Native, para testearlas
 * en vitest. La pantalla vive en `app/pausa.tsx`.
 */

/** Ruta de la pausa. Las entradas (inicio, final de Sentir) llaman a `goToPause`. */
export const PAUSE_ROUTE = "/pausa";

export const PAUSE_DURATION_MS = tokens.motion.pause;

export type PauseVerse = { book: string; chapter: number; verse: number };

type RawParam = string | string[] | undefined;

const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

const positiveInt = (value: RawParam) => {
  const raw = first(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : undefined;
};

/** Params de ruta (todo string). Sin versículo, la pausa usa el del día. */
export function pauseRouteParams(verse?: PauseVerse | null): Record<string, string> {
  if (!verse) return {};
  return { book: verse.book, chapter: String(verse.chapter), verse: String(verse.verse) };
}

/**
 * Lo inverso de `pauseRouteParams`. Un libro que no existe, un capítulo fuera
 * de rango o un versículo que falta devuelven null: la pausa cae al versículo
 * del día en vez de mostrar una cita rota.
 */
export function readPauseParams(raw: { book?: RawParam; chapter?: RawParam; verse?: RawParam }): PauseVerse | null {
  const bookName = first(raw.book);
  const book = bookName ? findBook(bookName) : null;
  const chapter = positiveInt(raw.chapter);
  const verse = positiveInt(raw.verse);
  if (!book || chapter === undefined || verse === undefined || chapter > book.chapters) return null;
  return { book: book.name, chapter, verse };
}

/**
 * Qué versículo se muestra: el que viene de Sentir si llegó uno válido; si no,
 * el del devocional del día. Siempre una cita del corpus, nunca texto libre
 * (regla dura #4): el texto se busca después con `rag.verses.citedForUser`.
 */
export function choosePauseVerse(fromRoute: PauseVerse | null, todayVerseRef: string | null | undefined): PauseVerse | null {
  if (fromRoute) return fromRoute;
  return todayVerseRef ? parseVerseRef(todayVerseRef) : null;
}

/** Fracción del minuto que ya pasó, entre 0 y 1. Sin inicio todavía, 0. */
export function pauseProgress(startedAt: number | null, now: number, duration: number = PAUSE_DURATION_MS): number {
  if (startedAt === null) return 0;
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / duration));
}

/** Milisegundos que faltan; nunca negativo. Se calcula contra el reloj para no derivar si la app pasa a segundo plano. */
export function pauseRemaining(startedAt: number, now: number, duration: number = PAUSE_DURATION_MS): number {
  return Math.max(0, startedAt + duration - now);
}

export type PausePhase = "waiting" | "running" | "done";

/** `waiting` mientras carga el versículo; `running` durante el minuto; `done` al "Amén". */
export function pausePhase(startedAt: number | null, now: number, duration: number = PAUSE_DURATION_MS): PausePhase {
  if (startedAt === null) return "waiting";
  return pauseProgress(startedAt, now, duration) >= 1 ? "done" : "running";
}
