import { normalizeText } from "./bookSearch";

export type HighlightSegment = {
  text: string;
  match: boolean;
};

/**
 * Parte el texto de un versículo en tramos para resaltar el término buscado
 * (#112). El match es insensible a mayúsculas y tildes — el corpus RV1909 está
 * lleno de "amó", "salvación", y nadie escribe las tildes en un buscador — pero
 * los tramos devueltos conservan el texto original, tildes incluidas.
 *
 * Trabaja sobre la forma normalizada carácter a carácter, no sobre una regex
 * con el término del usuario: así una búsqueda con ".", "*" o "(" no rompe nada.
 */
export function highlightSegments(text: string, term: string): HighlightSegment[] {
  const words = normalizeText(term).split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [{ text, match: false }];
  }

  const normalized = normalizeText(text);
  // normalizeText hace trim, que desalinea los índices si el texto arranca con
  // espacios. Se corrige con el offset del primer caracter no vacío.
  const offset = text.length - text.trimStart().length;

  const ranges: Array<[number, number]> = [];
  for (const word of words) {
    let from = 0;
    for (;;) {
      const at = normalized.indexOf(word, from);
      if (at < 0) {
        break;
      }
      ranges.push([at + offset, at + offset + word.length]);
      from = at + word.length;
    }
  }

  if (ranges.length === 0) {
    return [{ text, match: false }];
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (end <= cursor) {
      continue;
    }
    const from = Math.max(start, cursor);
    if (from > cursor) {
      segments.push({ text: text.slice(cursor, from), match: false });
    }
    segments.push({ text: text.slice(from, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments;
}
