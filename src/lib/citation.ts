/**
 * Cómo se lee una cita bíblica en la app: "Salmos 46:1 · RV1909". Única
 * implementación; la usa `CitationLink` (#192) en cada pantalla que muestra
 * una cita.
 */
export type Citation = { book: string; chapter: number; verse?: number; version?: string };

export function formatCitation(citation: Citation): string {
  const reference = `${citation.book} ${citation.chapter}${citation.verse === undefined ? "" : `:${citation.verse}`}`;
  return citation.version ? `${reference} · ${citation.version}` : reference;
}
