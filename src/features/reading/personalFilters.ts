import { normalizeText } from "../../lib/normalizeText";
import type { HighlightColor } from "./highlightColors";

/**
 * Buscar y filtrar lo propio: guardados (con sus notas) y subrayados. Todo se
 * hace en el teléfono sobre lo que ya bajó: las notas no viajan a ningún
 * buscador ni a la IA.
 */

type VerseLike = { book: string; chapter: number; verse: number; text: string | null };

/**
 * Busca sin tildes ni mayúsculas en la referencia ("juan 3:16", "salmos 23"),
 * el texto del versículo y la nota. Cada palabra tiene que aparecer en algún
 * lado: "paz nota" encuentra un guardado con "paz" en el texto y "nota" en la
 * nota.
 */
export function matchesQuery(item: VerseLike & { note?: string | null }, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeText(
    [`${item.book} ${item.chapter}:${item.verse}`, item.text ?? "", item.note ?? ""].join(" \n "),
  );
  return words.every((word) => haystack.includes(word));
}

export type BookmarkFilter = "todos" | "con-nota";

export const BOOKMARK_FILTERS: readonly { id: BookmarkFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "con-nota", label: "Con nota" },
];

export function filterBookmarks<T extends VerseLike & { note: string | null }>(
  items: readonly T[],
  options: { query: string; filter: BookmarkFilter },
): T[] {
  return items.filter(
    (item) => (options.filter === "todos" || item.note !== null) && matchesQuery(item, options.query),
  );
}

export type HighlightFilter = "todos" | HighlightColor;

export function filterHighlights<T extends VerseLike & { color: HighlightColor }>(
  items: readonly T[],
  options: { query: string; color: HighlightFilter },
): T[] {
  return items.filter(
    (item) => (options.color === "todos" || item.color === options.color) && matchesQuery(item, options.query),
  );
}

/** Cuántos hay de cada color, para mostrarlo en el filtro ("Salvia · 4"). */
export function countByColor(items: readonly { color: HighlightColor }[]): Record<HighlightColor, number> {
  const counts: Record<HighlightColor, number> = { amber: 0, sage: 0, clay: 0, sand: 0 };
  for (const item of items) counts[item.color] += 1;
  return counts;
}
