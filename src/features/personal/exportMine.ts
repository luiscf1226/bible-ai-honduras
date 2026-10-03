import designTokens from "../../../design/tokens.json";
import { indexOfBook } from "../../lib/bibleBooks";
import { tokens } from "../../theme/tokens";
import { HIGHLIGHT_SWATCHES, type HighlightColor } from "../reading/highlightColors";

/**
 * "Exportar lo mío" (#173): arma el texto plano y el HTML del PDF a partir de
 * los guardados (con su nota) y los subrayados. Lógica pura: la pantalla solo
 * pide los datos, llama a estas funciones y entrega el resultado a la hoja de
 * compartir. No incluye Sentir ni conversaciones.
 *
 * Todo el texto bíblico viene tal cual del corpus (el backend devuelve null si
 * el versículo no está en esa versión): acá no se genera ni se completa nada.
 */

export type ExportBookmark = {
  book: string;
  chapter: number;
  verse: number;
  createdAt: number;
  version: string;
  text: string | null;
  note: string | null;
};

export type ExportHighlight = {
  book: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  updatedAt: number;
  version: string;
  text: string | null;
};

/**
 * Peticiones de oración (#159). Todavía no existen en el backend; cuando
 * lleguen, la pantalla las pasa acá y salen en su propia sección.
 */
export type ExportPrayer = { text: string; createdAt: number; answeredAt?: number | null };

export type ExportInput = {
  bookmarks: ExportBookmark[];
  highlights: ExportHighlight[];
  prayers?: ExportPrayer[];
  generatedAt: number;
};

export type ExportEntry = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  version: string;
  text: string | null;
  savedAt: number | null;
  note: string | null;
  highlight: { color: HighlightColor; at: number } | null;
};

export type ExportCounts = { saved: number; notes: number; highlights: number; prayers: number };

export type ExportDocument = {
  generatedAt: number;
  books: Array<{ book: string; entries: ExportEntry[] }>;
  prayers: ExportPrayer[];
  counts: ExportCounts;
  /** Elementos exportables: guardados + subrayados + peticiones (la nota va con su guardado). */
  total: number;
};

export const EXPORT_TITLE = "Lo mío";
export const EXPORT_EMPTY_COPY =
  "Todavía no tenés nada para exportar. Guardá o subrayá un versículo en el lector y aparece acá.";
const MISSING_TEXT = "(El texto de este versículo no está disponible en esta versión.)";

const key = (ref: { book: string; chapter: number; verse: number }) => `${ref.book}|${ref.chapter}|${ref.verse}`;

/** Orden del canon; un libro desconocido va al final, por nombre. */
function compareRefs(a: ExportEntry, b: ExportEntry): number {
  const ai = indexOfBook(a.book);
  const bi = indexOfBook(b.book);
  const ao = ai < 0 ? Number.MAX_SAFE_INTEGER : ai;
  const bo = bi < 0 ? Number.MAX_SAFE_INTEGER : bi;
  return ao - bo || a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse;
}

export function exportCounts(input: Pick<ExportInput, "bookmarks" | "highlights" | "prayers">): ExportCounts {
  return {
    saved: input.bookmarks.length,
    notes: input.bookmarks.filter((item) => (item.note ?? "").trim().length > 0).length,
    highlights: input.highlights.length,
    prayers: input.prayers?.length ?? 0,
  };
}

export function exportTotal(counts: ExportCounts): number {
  return counts.saved + counts.highlights + counts.prayers;
}

/** Un versículo guardado y subrayado sale una sola vez, con las dos marcas. */
export function buildExportDocument(input: ExportInput): ExportDocument {
  const byRef = new Map<string, ExportEntry>();
  const entryFor = (ref: { book: string; chapter: number; verse: number; version: string; text: string | null }) => {
    const existing = byRef.get(key(ref));
    if (existing) {
      if (existing.text === null && ref.text !== null) existing.text = ref.text;
      return existing;
    }
    const entry: ExportEntry = {
      book: ref.book,
      chapter: ref.chapter,
      verse: ref.verse,
      reference: `${ref.book} ${ref.chapter}:${ref.verse}`,
      version: ref.version,
      text: ref.text,
      savedAt: null,
      note: null,
      highlight: null,
    };
    byRef.set(key(ref), entry);
    return entry;
  };

  for (const bookmark of input.bookmarks) {
    const entry = entryFor(bookmark);
    entry.savedAt = bookmark.createdAt;
    const note = (bookmark.note ?? "").trim();
    entry.note = note.length > 0 ? note : null;
  }
  for (const highlight of input.highlights) {
    entryFor(highlight).highlight = { color: highlight.color, at: highlight.updatedAt };
  }

  const books: ExportDocument["books"] = [];
  for (const entry of [...byRef.values()].sort(compareRefs)) {
    const last = books[books.length - 1];
    if (last && last.book === entry.book) last.entries.push(entry);
    else books.push({ book: entry.book, entries: [entry] });
  }

  const prayers = [...(input.prayers ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  const counts = exportCounts(input);
  return { generatedAt: input.generatedAt, books, prayers, counts, total: exportTotal(counts) };
}

/** Los primeros versículos del archivo (en el mismo orden) y cuántos más hay. */
export function exportPreview(doc: ExportDocument, count: number): { entries: ExportEntry[]; more: number } {
  const all = doc.books.flatMap((group) => group.entries);
  return { entries: all.slice(0, count), more: Math.max(0, all.length - count) };
}

/** "2 de octubre de 2026", en hora de Honduras. */
export function exportDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(timestamp));
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "5 guardados · 2 notas · 4 subrayados" (lo que esté en cero no aparece). */
export function exportSummary(counts: ExportCounts): string {
  const parts = [
    counts.saved > 0 ? plural(counts.saved, "guardado", "guardados") : null,
    counts.notes > 0 ? plural(counts.notes, "nota", "notas") : null,
    counts.highlights > 0 ? plural(counts.highlights, "subrayado", "subrayados") : null,
    counts.prayers > 0 ? plural(counts.prayers, "petición", "peticiones") : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "Nada todavía";
}

function highlightLabel(color: HighlightColor): string {
  return (HIGHLIGHT_SWATCHES.find((item) => item.key === color)?.label ?? "").toLowerCase();
}

/** "Guardado el 1 de octubre de 2026 · Subrayado en ámbar el 30 de septiembre de 2026" */
export function entryMarks(entry: ExportEntry): string {
  const marks: string[] = [];
  if (entry.savedAt !== null) marks.push(`Guardado el ${exportDate(entry.savedAt)}`);
  if (entry.highlight) marks.push(`Subrayado en ${highlightLabel(entry.highlight.color)} el ${exportDate(entry.highlight.at)}`);
  return marks.join(" · ");
}

function versionsOf(doc: ExportDocument): string {
  const versions = new Set(doc.books.flatMap((group) => group.entries.map((entry) => entry.version)));
  return [...versions].join(", ");
}

function prayerLine(prayer: ExportPrayer): string {
  const answered = prayer.answeredAt ? ` · Respondida el ${exportDate(prayer.answeredAt)}` : "";
  return `Anotada el ${exportDate(prayer.createdAt)}${answered}`;
}

/** Texto plano, para la hoja de compartir o para copiar a un cuaderno. */
export function buildExportText(doc: ExportDocument): string {
  const lines: string[] = [
    `${EXPORT_TITLE} — Bible AI Honduras`,
    `Exportado el ${exportDate(doc.generatedAt)}`,
    exportSummary(doc.counts),
  ];
  const versions = versionsOf(doc);
  if (versions) lines.push(`Versión de la Biblia: ${versions}`);

  for (const group of doc.books) {
    lines.push("", group.book.toUpperCase());
    for (const entry of group.entries) {
      lines.push("", `${entry.reference} (${entry.version})`);
      lines.push(entry.text !== null ? `«${entry.text}»` : MISSING_TEXT);
      lines.push(entryMarks(entry));
      if (entry.note) lines.push(`Mi nota: ${entry.note}`);
    }
  }

  if (doc.prayers.length > 0) {
    lines.push("", "PETICIONES");
    for (const prayer of doc.prayers) {
      lines.push("", prayer.text, prayerLine(prayer));
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Escapa lo que escribió la persona (y el texto bíblico) antes de meterlo al HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const px = (value: number) => `${value}px`;

/**
 * HTML para `expo-print`. Todo valor visual sale de `design/tokens.json` /
 * `src/theme/tokens.ts`: paleta de día (se imprime en papel claro), EB Garamond
 * para referencias y versículos, DM Sans para lo demás.
 */
export function buildExportHtml(doc: ExportDocument): string {
  const c = tokens.color;
  const t = tokens.type;
  const serif = `'${designTokens.font.serif}', serif`;
  const sans = `'${designTokens.font.sans}', sans-serif`;
  const weight = designTokens.font.weight;

  const style = `
    @page { margin: ${px(tokens.space.xxl * 2)}; }
    body { background: ${c.surface}; color: ${c.ink}; font-family: ${sans}; font-weight: ${weight.light};
      font-size: ${px(t.bodySm.size)}; line-height: ${px(t.bodySm.lineHeight)}; margin: 0; }
    h1 { font-family: ${serif}; font-weight: ${weight.regular}; font-size: ${px(t.display.size)};
      line-height: ${px(t.display.lineHeight)}; margin: 0; }
    .meta { color: ${c.inkMuted}; font-size: ${px(t.caption.size)}; line-height: ${px(t.caption.lineHeight)}; margin-top: ${px(tokens.space.md)}; }
    h2 { color: ${c.inkSoft}; font-family: ${sans}; font-weight: ${weight.light}; font-size: ${px(t.overline.size)};
      letter-spacing: ${t.overline.letterSpacing}em; text-transform: uppercase; margin: ${px(tokens.space.xxl * 2)} 0 ${px(tokens.space.md)};
      padding-bottom: ${px(tokens.space.xs)}; border-bottom: 1px solid ${c.border}; }
    .entry { break-inside: avoid; padding: ${px(tokens.space.md)} 0; border-bottom: 1px solid ${c.border}; }
    .ref { font-family: ${serif}; font-size: ${px(t.subtitle.size)}; line-height: ${px(t.subtitle.lineHeight)}; }
    .version { color: ${c.inkMuted}; font-family: ${sans}; font-size: ${px(t.caption.size)}; }
    .verse { font-family: ${serif}; font-size: ${px(t.versePicker.size)}; line-height: ${px(t.versePicker.lineHeight)};
      margin: ${px(tokens.space.xs)} 0; }
    .verse span { border-radius: ${px(tokens.radius.sm)}; padding: 0 ${px(tokens.space.xxs)}; }
    .missing { color: ${c.inkSoft}; font-style: italic; }
    .marks { color: ${c.inkMuted}; font-size: ${px(t.caption.size)}; line-height: ${px(t.caption.lineHeight)}; }
    .note { background: ${c.surfaceSunk}; border-radius: ${px(tokens.radius.md)}; margin-top: ${px(tokens.space.sm)};
      padding: ${px(tokens.space.sm)} ${px(tokens.space.md)}; white-space: pre-wrap; }
    .note b { color: ${c.accentDeep}; font-weight: ${weight.medium}; }
    .footer { color: ${c.inkFaint}; font-size: ${px(t.caption.size)}; margin-top: ${px(tokens.space.xxl * 2)}; text-align: center; }
  `;

  const highlightFillFor = (color: HighlightColor) => {
    const swatch = HIGHLIGHT_SWATCHES.find((item) => item.key === color) ?? HIGHLIGHT_SWATCHES[0];
    return c[swatch.fill];
  };

  const entryHtml = (entry: ExportEntry) => {
    const verse =
      entry.text === null
        ? `<p class="verse missing">${escapeHtml(MISSING_TEXT)}</p>`
        : entry.highlight
          ? `<p class="verse"><span style="background: ${highlightFillFor(entry.highlight.color)}">${escapeHtml(entry.text)}</span></p>`
          : `<p class="verse">${escapeHtml(entry.text)}</p>`;
    const note = entry.note ? `<div class="note"><b>Mi nota</b><br>${escapeHtml(entry.note)}</div>` : "";
    return `<div class="entry"><div class="ref">${escapeHtml(entry.reference)} <span class="version">${escapeHtml(entry.version)}</span></div>${verse}<div class="marks">${escapeHtml(entryMarks(entry))}</div>${note}</div>`;
  };

  const sections = doc.books
    .map((group) => `<h2>${escapeHtml(group.book)}</h2>${group.entries.map(entryHtml).join("")}`)
    .join("");
  const prayers =
    doc.prayers.length > 0
      ? `<h2>Peticiones</h2>${doc.prayers
          .map((prayer) => `<div class="entry"><p>${escapeHtml(prayer.text)}</p><div class="marks">${escapeHtml(prayerLine(prayer))}</div></div>`)
          .join("")}`
      : "";
  const versions = versionsOf(doc);

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${EXPORT_TITLE}</title><style>${style}</style></head><body><h1>${EXPORT_TITLE}</h1><div class="meta">Exportado el ${escapeHtml(exportDate(doc.generatedAt))} · ${escapeHtml(exportSummary(doc.counts))}${versions ? ` · ${escapeHtml(versions)}` : ""}</div>${sections}${prayers}<div class="footer">Bible AI Honduras</div></body></html>`;
}
