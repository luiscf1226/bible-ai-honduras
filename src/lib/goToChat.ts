import { router } from "expo-router";

import type { PassageQuery } from "../features/reading/bookSearch";
import { findBook } from "./bibleBooks";

/** Ruta de Preguntar: desde U6 (#198) el chat es la pantalla principal. */
export const PREGUNTAR_ROUTE = "/preguntar";

export type ChatParams = {
  book?: string;
  chapter?: number;
  verse?: number;
  /** Retoma esa conversación (#191). Sin él, Preguntar abre un tema nuevo. */
  conversationId?: string;
  /** Prellena el campo sin enviarlo (tarjeta del inicio, U1). */
  pregunta?: string;
};

/**
 * Params de ruta (todo string) para abrir Preguntar. Puro, para poder testear
 * el contrato que usan el lector, Sentir, `/hoy` e Historias sin montar el
 * router. Un pasaje sin capítulo no se manda: el chip necesita libro y capítulo.
 */
export function chatRouteParams(params: ChatParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (params.conversationId) out.conversationId = params.conversationId;
  if (params.book && params.chapter !== undefined) {
    out.book = params.book;
    out.chapter = String(params.chapter);
    if (params.verse !== undefined) out.verse = String(params.verse);
  }
  const pregunta = params.pregunta?.trim();
  if (pregunta) out.pregunta = pregunta;
  return out;
}

type RawParam = string | string[] | undefined;

const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

const positiveInt = (value: RawParam) => {
  const raw = first(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : undefined;
};

/**
 * Lo inverso de `chatRouteParams`: lee lo que llegó en la URL. Un libro que no
 * existe o un capítulo que no es número no precargan el chip (deep link roto
 * → Preguntar abre sin pasaje, no con "Jaun NaN").
 */
export function readChatParams(raw: {
  book?: RawParam;
  chapter?: RawParam;
  verse?: RawParam;
  conversationId?: RawParam;
  pregunta?: RawParam;
}): { passage: PassageQuery | null; conversationId?: string; pregunta: string } {
  const book = first(raw.book) ? findBook(first(raw.book) as string) : null;
  const chapter = positiveInt(raw.chapter);
  const verse = positiveInt(raw.verse);
  const passage =
    book && chapter !== undefined && chapter <= book.chapters
      ? { book: book.name, chapter, ...(verse === undefined ? {} : { verse }) }
      : null;
  const conversationId = first(raw.conversationId) || undefined;
  return { passage, conversationId, pregunta: first(raw.pregunta)?.trim() ?? "" };
}

/**
 * Entrada única a Preguntar con un pasaje opcional. Lectura, Sentir, `/hoy` e
 * Historias reutilizan este contrato en vez de construir una navegación
 * paralela (#112/#113). El pasaje llega precargado en el chip (#198).
 */
export function goToChat(params: ChatParams) {
  router.push({ pathname: PREGUNTAR_ROUTE, params: chatRouteParams(params) });
}
