import { router } from "expo-router";

/**
 * Entrada única a Preguntar con un pasaje opcional. Lectura reutiliza este
 * contrato en vez de construir una navegación paralela para su hoja de
 * acciones (#112/#113).
 */
export function goToChat(params: { book?: string; chapter?: number; verse?: number }) {
  const stringParams: Record<string, string> = {};
  if (params.book) stringParams.book = params.book;
  if (params.chapter !== undefined) stringParams.chapter = String(params.chapter);
  if (params.verse !== undefined) stringParams.verse = String(params.verse);
  router.push({ pathname: "/preguntar/chat", params: stringParams });
}
