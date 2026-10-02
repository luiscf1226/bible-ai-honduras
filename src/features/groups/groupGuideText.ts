/**
 * "Preparar para mi grupo" (#188): textos que salen de la guía. Puro, sin
 * React, para poder testearlo.
 */

export type GuideCitation = { book: string; chapter: number; verse: number; version: string; text: string };
export type GuideItem = { text: string; citations: GuideCitation[] };
export type GroupGuideView = {
  book: string;
  chapter: number;
  version: string;
  summary: GuideItem;
  questions: GuideItem[];
  truncatedAtVerse: number | null;
};

/** "Rut 1:16-17" si son seguidos, "Rut 1:1, 16" si no. Una sola referencia por pieza. */
export function citationsLabel(citations: readonly GuideCitation[]): string {
  if (citations.length === 0) return "";
  const first = citations[0]!;
  const verses = [...new Set(citations.map((c) => c.verse))].sort((a, b) => a - b);
  const consecutive = verses.every((verse, index) => index === 0 || verse === verses[index - 1]! + 1);
  const list =
    verses.length > 1 && consecutive ? `${verses[0]}-${verses[verses.length - 1]}` : verses.join(", ");
  return `${first.book} ${first.chapter}:${list}`;
}

export const GROUP_GUIDE_STEPS = [
  "Leyendo el capítulo…",
  "Buscando el comentario…",
  "Escribiendo las preguntas…",
] as const;

/** El aviso de que la guía cubre solo el inicio de un capítulo muy largo. */
export function truncatedNotice(guide: Pick<GroupGuideView, "truncatedAtVerse">): string | null {
  return guide.truncatedAtVerse === null
    ? null
    : `El capítulo es largo: esta guía cubre hasta el versículo ${guide.truncatedAtVerse}.`;
}

/**
 * Lo que se manda por WhatsApp (por `src/lib/share.ts`, regla dura #3): el
 * resumen y las preguntas, cada pieza con su referencia. Sin el texto completo
 * de cada versículo, para que el mensaje se pueda leer en el teléfono.
 */
export function buildGuideShareText(guide: GroupGuideView): string {
  const lines = [
    `Para conversar en el grupo · ${guide.book} ${guide.chapter} (${guide.version})`,
    "",
    `${guide.summary.text} (${citationsLabel(guide.summary.citations)})`,
    "",
    ...guide.questions.map((item, index) => `${index + 1}. ${item.text} (${citationsLabel(item.citations)})`),
  ];
  return lines.join("\n");
}
