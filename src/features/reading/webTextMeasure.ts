/**
 * Medición de renglones en web (#195). En iOS y Android los renglones salen de
 * `onTextLayout`; react-native-web no lo implementa, así que en el navegador
 * (el harness de QA) se miden con el DOM. Nada de esto corre en el teléfono:
 * la pantalla solo lo llama con `Platform.OS === "web"`.
 */

type Rect = { top: number; height: number };
type DomElement = {
  children: ArrayLike<DomElement>;
  firstChild: unknown;
  getBoundingClientRect: () => Rect;
  getClientRects: () => ArrayLike<Rect>;
};

function asElement(target: unknown): DomElement | null {
  if (typeof target !== "object" || target === null) return null;
  return "getBoundingClientRect" in target && "children" in target ? (target as DomElement) : null;
}

/**
 * Tope del primer renglón de cada hijo (un `<Text>` anidado por pedazo de
 * versículo), relativo al bloque. Se corrige del alto de la caja en línea al
 * alto del renglón para que coincida con lo que da `onTextLayout`.
 */
export function childLineTopsFromDom(target: unknown, lineHeight: number): number[] | null {
  const element = asElement(target);
  if (!element) return null;
  const origin = element.getBoundingClientRect().top;
  const tops: number[] = [];
  for (let index = 0; index < element.children.length; index += 1) {
    const rect = element.children[index].getClientRects()[0];
    if (!rect) return null;
    tops.push(rect.top - origin - (lineHeight - rect.height) / 2);
  }
  return tops;
}

/** Caracteres que entran en los primeros `lines` renglones de un texto plano. */
export function charsInFirstLinesFromDom(target: unknown, lines: number): number | null {
  const element = asElement(target);
  const doc = (globalThis as { document?: { createRange?: () => DomRange } }).document;
  if (!element || !doc?.createRange) return null;
  const node = element.firstChild as { length?: number } | null;
  if (!node || typeof node.length !== "number") return null;
  const range = doc.createRange();
  let line = 0;
  let lastTop: number | null = null;
  for (let index = 0; index < node.length; index += 1) {
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    const top = range.getBoundingClientRect().top;
    if (lastTop !== null && top > lastTop + 1) {
      line += 1;
      if (line >= lines) return index;
    }
    lastTop = top;
  }
  return null;
}

type DomRange = {
  setStart: (node: unknown, offset: number) => void;
  setEnd: (node: unknown, offset: number) => void;
  getBoundingClientRect: () => Rect;
};
