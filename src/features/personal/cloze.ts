import { normalizeText } from "../../lib/normalizeText";

/**
 * Ejercicio de completar palabras de Memorizar (#158). Lógica pura: qué
 * palabras se esconden, el banco de palabras para tocar y la corrección.
 *
 * - Se esconden más palabras a medida que el versículo sube de nivel
 *   (25 %, 40 %, 60 %, 80 %), con un mínimo de una y un tope de
 *   `CLOZE_MAX_BLANKS` para que el banco entre en pantalla.
 * - Solo se esconden palabras de 3 letras o más: esconder "y", "á" o "de" no
 *   ayuda a memorizar nada.
 * - La elección es determinística por semilla (versículo + día): el mismo
 *   ejercicio si se vuelve a abrir la pantalla el mismo día.
 * - La corrección ignora mayúsculas y tildes; dos palabras iguales en el banco
 *   son intercambiables.
 */

export const CLOZE_HIDE_RATIOS = [0.25, 0.4, 0.6, 0.8] as const;
export const CLOZE_MAX_BLANKS = 8;
const MIN_WORD_LENGTH = 3;

export type ClozePart = { kind: "text"; text: string } | { kind: "blank"; blank: number };

export type Cloze = {
  parts: ClozePart[];
  /** Palabra escondida de cada hueco, en orden de lectura. */
  answers: string[];
  /** Las mismas palabras, mezcladas, para tocar. */
  bank: string[];
};

/** `filled[hueco]` = índice del banco que la persona puso ahí, o null. */
export type ClozeFill = Array<number | null>;

/** FNV-1a de 32 bits: estable entre ejecuciones, sin Math.random. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: generador sembrado, suficiente para mezclar unas palabras. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Palabras y lo que hay entre ellas (espacios, comas, punto y coma…). */
export function tokenize(text: string): Array<{ word: boolean; text: string }> {
  return (text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? []).map((piece) => ({
    word: /[\p{L}\p{N}]/u.test(piece),
    text: piece,
  }));
}

/** Cuántas palabras se esconden para un nivel, dado cuántas se pueden esconder. */
export function blanksFor(level: number, candidates: number): number {
  if (candidates === 0) return 0;
  const safeLevel = Number.isFinite(level) ? Math.min(CLOZE_HIDE_RATIOS.length - 1, Math.max(0, Math.floor(level))) : 0;
  const wanted = Math.round(candidates * CLOZE_HIDE_RATIOS[safeLevel]);
  return Math.min(CLOZE_MAX_BLANKS, candidates, Math.max(1, wanted));
}

export function buildCloze(text: string, level: number, seed: string): Cloze {
  const tokens = tokenize(text);
  const candidates = tokens.flatMap((token, index) =>
    token.word && normalizeText(token.text).length >= MIN_WORD_LENGTH ? [index] : [],
  );
  const random = seededRandom(hash(seed));
  const hidden = new Set(shuffled(candidates, random).slice(0, blanksFor(level, candidates.length)));

  const parts: ClozePart[] = [];
  const answers: string[] = [];
  let pending = "";
  tokens.forEach((token, index) => {
    if (!hidden.has(index)) {
      pending += token.text;
      return;
    }
    if (pending) parts.push({ kind: "text", text: pending });
    pending = "";
    parts.push({ kind: "blank", blank: answers.length });
    answers.push(token.text);
  });
  if (pending) parts.push({ kind: "text", text: pending });

  return { parts, answers, bank: shuffled(answers, random) };
}

export function emptyFill(cloze: Cloze): ClozeFill {
  return cloze.answers.map(() => null);
}

/** Bancos ya usados en algún hueco. */
export function usedBank(filled: ClozeFill): Set<number> {
  return new Set(filled.filter((value): value is number => value !== null));
}

/** Pone la palabra del banco en el primer hueco libre. Sin cambios si ya estaba usada o no hay huecos. */
export function placeWord(filled: ClozeFill, bankIndex: number): ClozeFill {
  if (usedBank(filled).has(bankIndex)) return filled;
  const slot = filled.indexOf(null);
  if (slot === -1) return filled;
  const next = [...filled];
  next[slot] = bankIndex;
  return next;
}

/** Saca la palabra de un hueco (vuelve al banco). */
export function clearBlank(filled: ClozeFill, blank: number): ClozeFill {
  if (filled[blank] === null || filled[blank] === undefined) return filled;
  const next = [...filled];
  next[blank] = null;
  return next;
}

export function isComplete(filled: ClozeFill): boolean {
  return filled.every((value) => value !== null);
}

/** Acertó si cada hueco tiene la palabra correcta (sin mirar mayúsculas ni tildes). */
export function gradeCloze(cloze: Cloze, filled: ClozeFill): boolean {
  return (
    isComplete(filled) &&
    cloze.answers.every((answer, blank) => normalizeText(cloze.bank[filled[blank] as number] ?? "") === normalizeText(answer))
  );
}
