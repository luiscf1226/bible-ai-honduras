/**
 * "Mis conversaciones" (#232, Fase 3): el único historial de la app. Antes
 * estaba en 5 lugares (`/historial`, los cajones de Preguntar y Sentir, dos
 * renglones de Mi espacio y Ajustes). Lógica pura del filtro y de a dónde
 * lleva cada conversación.
 */

export type ConversationModule = "qa" | "voices" | "feelings";
export type ConversationFilter = "todo" | ConversationModule;

export const CONVERSATION_FILTERS: ReadonlyArray<{ id: ConversationFilter; label: string }> = [
  { id: "todo", label: "Todo" },
  { id: "qa", label: "Preguntar" },
  { id: "feelings", label: "Sentir" },
  { id: "voices", label: "Personajes" },
];

/** `?filtro=` de la URL (los cajones llegan con el suyo); cualquier otra cosa es "Todo". */
export function conversationFilterFrom(raw: string | string[] | undefined): ConversationFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return CONVERSATION_FILTERS.some((filter) => filter.id === value) ? (value as ConversationFilter) : "todo";
}

export function filterConversations<T extends { module: ConversationModule }>(items: readonly T[], filter: ConversationFilter): T[] {
  return filter === "todo" ? [...items] : items.filter((item) => item.module === filter);
}

export type ConversationTarget =
  | { kind: "qa"; conversationId: string }
  | { kind: "feelings"; devotionalId: string }
  | { kind: "voices"; slug: string }
  | null;

/** A dónde abre una conversación del historial: la misma pantalla donde se tuvo. */
export function conversationTarget(item: { id: string; module: ConversationModule; characterId?: string | null }): ConversationTarget {
  if (item.module === "qa") return { kind: "qa", conversationId: item.id };
  if (item.module === "feelings") return { kind: "feelings", devotionalId: item.id };
  return item.characterId ? { kind: "voices", slug: item.characterId } : null;
}
