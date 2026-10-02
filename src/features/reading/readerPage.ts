/**
 * Página del lector "Biblia de papel" (#195, U3). Todo acá es puro para poder
 * testearlo sin montar la pantalla:
 *
 * - El capítulo se pinta como **prosa continua** en bloques ("runs") de ~20
 *   versículos: un `<Text>` por bloque con un `<Text>` anidado por versículo.
 *   Así Salmos 119 son 9 nodos de texto en vez de 176 filas.
 * - El primer bloque se parte en dos para la capitular: los renglones que van
 *   al lado del número grande (con sangría) y el resto a todo el ancho.
 * - Las marcas del margen, la cinta del separador y el scroll al versículo
 *   (#154) necesitan saber a qué altura empieza cada versículo dentro de su
 *   bloque: sale de los renglones que reporta `onTextLayout`.
 */

export type PageVerse = { verse: number; text: string };

export type RunSegment = {
  verse: number;
  text: string;
  /** El número voladito va solo en el primer pedazo de un versículo partido. */
  showNumber: boolean;
  /** El espacio entre versículos va al final del último pedazo. */
  endsVerse: boolean;
};

export type ReaderRun = { key: string; segments: RunSegment[] };

/** Versículos por bloque de texto (design/oleada-ux.md §U3). */
export const VERSES_PER_RUN = 20;

const SUPERSCRIPT_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/**
 * Número voladito con las cifras superíndice de EB Garamond: React Native no
 * tiene `baselineOffset` para un `<Text>` anidado, así que el superíndice sale
 * de la fuente y no de un desplazamiento inventado.
 */
export function superscriptNumber(value: number): string {
  return String(value)
    .split("")
    .map((digit) => SUPERSCRIPT_DIGITS[Number(digit)] ?? digit)
    .join("");
}

/**
 * Espacio fino después del número + "word joiner" para que el número nunca
 * quede solo al final de un renglón.
 */
export const VERSE_NUMBER_GAP = " ⁠";

export function segmentNumber(segment: RunSegment): string {
  return segment.showNumber ? `${superscriptNumber(segment.verse)}${VERSE_NUMBER_GAP}` : "";
}

export function segmentBody(segment: RunSegment): string {
  return segment.endsVerse ? `${segment.text} ` : segment.text;
}

export function runText(run: ReaderRun): string {
  return run.segments.map((segment) => segmentNumber(segment) + segmentBody(segment)).join("");
}

/** Dónde empieza cada pedazo dentro del string del bloque. */
export function segmentOffsets(run: ReaderRun): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const segment of run.segments) {
    offsets.push(cursor);
    cursor += segmentNumber(segment).length + segmentBody(segment).length;
  }
  return offsets;
}

export function chunkVerses(verses: readonly PageVerse[], size = VERSES_PER_RUN): ReaderRun[] {
  const runs: ReaderRun[] = [];
  for (let index = 0; index < verses.length; index += size) {
    const slice = verses.slice(index, index + size);
    runs.push({
      key: `run-${slice[0].verse}`,
      segments: slice.map((verse) => ({ verse: verse.verse, text: verse.text, showNumber: true, endsVerse: true })),
    });
  }
  return runs;
}

/**
 * Parte un bloque en el carácter `at` (después de un espacio). Si `at` cae a
 * mitad de palabra, retrocede al espacio anterior. Devuelve null si no hay
 * dónde partir (bloque más corto que los renglones de la capitular).
 */
export function splitRunAt(run: ReaderRun, at: number): [ReaderRun, ReaderRun] | null {
  const text = runText(run);
  if (at <= 0 || at >= text.length) return null;
  let cut = at;
  while (cut > 0 && text[cut - 1] !== " ") cut -= 1;
  if (cut === 0) return null;

  const offsets = segmentOffsets(run);
  const lead: RunSegment[] = [];
  const rest: RunSegment[] = [];
  run.segments.forEach((segment, index) => {
    const start = offsets[index];
    const numberLength = segmentNumber(segment).length;
    const end = start + numberLength + segmentBody(segment).length;
    if (end <= cut) {
      lead.push(segment);
      return;
    }
    if (start >= cut) {
      rest.push(segment);
      return;
    }
    // El corte cae dentro del versículo: siempre después de un espacio del
    // cuerpo, nunca entre el número y el texto (VERSE_NUMBER_GAP no parte).
    const bodyCut = Math.max(0, cut - start - numberLength);
    lead.push({ ...segment, text: segment.text.slice(0, bodyCut), endsVerse: false });
    rest.push({ ...segment, text: segment.text.slice(bodyCut), showNumber: false });
  });
  if (lead.length === 0 || rest.length === 0) return null;
  return [
    { key: `${run.key}-lead`, segments: lead },
    { key: run.key, segments: rest },
  ];
}

export type TextLine = { text: string; y: number };

/**
 * Altura (relativa al bloque) del renglón donde empieza cada versículo, a
 * partir de los renglones de `onTextLayout`. Solo cuenta los pedazos con
 * número: un versículo partido "empieza" donde está su número.
 */
export function verseLineTops(run: ReaderRun, lines: readonly TextLine[]): Record<number, number> {
  const tops: Record<number, number> = {};
  if (lines.length === 0) return tops;
  const lineStarts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    lineStarts.push(cursor);
    cursor += line.text.length;
  }
  const offsets = segmentOffsets(run);
  run.segments.forEach((segment, index) => {
    if (!segment.showNumber) return;
    const offset = offsets[index];
    let lineIndex = 0;
    while (lineIndex + 1 < lineStarts.length && lineStarts[lineIndex + 1] <= offset) lineIndex += 1;
    tops[segment.verse] = lines[lineIndex].y;
  });
  return tops;
}

/** Cuántos renglones del cuerpo ocupa la capitular. */
export function dropCapLines(capLineHeight: number, bodyLineHeight: number): number {
  return Math.max(1, Math.ceil(capLineHeight / bodyLineHeight));
}

/**
 * Ancho medio de un carácter de EB Garamond en em (medido sobre el texto del
 * corpus). Solo sirve para estimar el corte de la capitular antes de medir, o
 * donde la plataforma no reporta renglones (web, en el harness de QA).
 */
const SERIF_AVERAGE_CHAR_EM = 0.38;

export function estimateCharsForLines(width: number, fontSize: number, lines: number): number {
  if (width <= 0 || fontSize <= 0) return 0;
  return Math.floor(width / (fontSize * SERIF_AVERAGE_CHAR_EM)) * lines;
}

/** Suma de caracteres de los primeros `count` renglones medidos. */
export function charsInLines(lines: readonly TextLine[], count: number): number {
  return lines.slice(0, count).reduce((total, line) => total + line.text.length, 0);
}
