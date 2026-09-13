import { parsePassageQuery, type PassageQuery } from "../reading/bookSearch";

/**
 * Puente Historias → lector (#115). Puro, sin react-native.
 *
 * Las referencias del catálogo de historias (`convex/stories.ts`) están
 * escritas para leerse, con raya tipográfica: "Génesis 6:13–22", "Ester 4–8".
 * Acá se normalizan y se resuelven con `parsePassageQuery` — no se reimplementa
 * el parseo de libro/capítulo/versículo.
 *
 * - "Libro c:v–w" → capítulo c, abierto en el versículo v.
 * - "Libro c:v"   → capítulo c, abierto en v.
 * - "Libro c–d"   → capítulo c (el primero del rango).
 * - "Libro c"     → capítulo c.
 *
 * Devuelve null si la referencia no resuelve a un capítulo real: la pantalla
 * no muestra el botón antes que abrir un link roto.
 */
export function parseStoryReference(reference: string): PassageQuery | null {
  const normalized = reference.trim().replace(/[‒-―]/g, "-").replace(/\s*-\s*/g, "-");
  if (normalized.length === 0) {
    return null;
  }

  const chapterRange = normalized.match(/^(.+?\s+\d+)-(\d+)$/);
  if (chapterRange && !normalized.includes(":")) {
    return parsePassageQuery(chapterRange[1]);
  }

  return parsePassageQuery(normalized);
}
