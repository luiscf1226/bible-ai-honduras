import { isYearInWordSeason, yearInWordYear } from "../../../convex/yearInWordCore";
import { shareContent, type ShareResult } from "../../lib/share";

/**
 * "Tu año en la Palabra" (#183): textos y reglas de la pantalla. Solo lectura,
 * sin premios ni comparaciones: son cuentas tranquilas, no un marcador.
 */

export type YearInWordSummary = {
  year: number;
  chaptersRead: number;
  planDays: number;
  savedVerses: number;
  topHighlight: {
    book: string;
    chapter: number;
    verse: number;
    chapterCount: number;
    version: string;
    text: string | null;
  } | null;
};

export type YearInWordRow = { id: "chapters" | "planDays" | "saved"; label: string; value: number };

/** Entrada de Mi espacio: solo en temporada (1 dic – 31 ene). null fuera de ella. */
export function yearInWordEntry(today: string): { year: number; title: string; hint: string } | null {
  if (!isYearInWordSeason(today)) return null;
  const year = yearInWordYear(today);
  return {
    year,
    title: `Tu ${year} en la Palabra`,
    hint: "Lo que leíste, cumpliste del plan, guardaste y subrayaste este año.",
  };
}

export function yearInWordTitle(year: number): string {
  return `Tu ${year} en la Palabra`;
}

const plural = (value: number, one: string, many: string) => (value === 1 ? one : many);

export function yearInWordRows(summary: YearInWordSummary): YearInWordRow[] {
  return [
    { id: "chapters", label: plural(summary.chaptersRead, "Capítulo leído", "Capítulos leídos"), value: summary.chaptersRead },
    { id: "planDays", label: plural(summary.planDays, "Día del plan cumplido", "Días del plan cumplidos"), value: summary.planDays },
    { id: "saved", label: plural(summary.savedVerses, "Versículo guardado", "Versículos guardados"), value: summary.savedVerses },
  ];
}

export function isYearInWordEmpty(summary: YearInWordSummary): boolean {
  return summary.chaptersRead === 0 && summary.planDays === 0 && summary.savedVerses === 0 && summary.topHighlight === null;
}

export function topHighlightReference(top: NonNullable<YearInWordSummary["topHighlight"]>): string {
  return `${top.book} ${top.chapter}:${top.verse}`;
}

/** "3 versículos subrayados en Salmos 46". */
export function topHighlightCaption(top: NonNullable<YearInWordSummary["topHighlight"]>): string {
  return `${top.chapterCount} ${plural(top.chapterCount, "versículo subrayado", "versículos subrayados")} en ${top.book} ${top.chapter}`;
}

/**
 * Texto para compartir. Lleva solo las cuentas y el versículo (texto del
 * corpus, nunca inventado): ni notas, ni nada de Sentir, ni conversaciones.
 * Las cuentas en cero no se mencionan.
 */
export function buildYearInWordShareText(summary: YearInWordSummary): string {
  const lines = [`Mi ${summary.year} en la Palabra:`];
  for (const row of yearInWordRows(summary)) {
    if (row.value > 0) lines.push(`· ${row.value} ${row.label.toLowerCase()}`);
  }
  const top = summary.topHighlight;
  if (top && top.text !== null) {
    lines.push("", `El que más subrayé: “${top.text}”`, `— ${topHighlightReference(top)} (${top.version})`);
  }
  return lines.join("\n");
}

/** Regla dura #3: el share sheet tiene un solo dueño (`src/lib/share.ts`). */
export function shareYearInWord(params: { summary: YearInWordSummary; referralCode: string }): Promise<ShareResult> {
  return shareContent({ referralCode: params.referralCode, text: buildYearInWordShareText(params.summary) });
}
