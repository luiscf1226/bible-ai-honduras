/**
 * Qué versiones de la Biblia están realmente disponibles — #93 §4a/§4b.
 * Este archivo es la única fuente de verdad: PRD.md, ARCHITECTURE.md y
 * docs/beta-testers.md apuntan acá en vez de repetir la lista.
 *
 * `users.bibleVersion` acepta "RVR1960" y "NVI" en el schema, pero **no hay
 * corpus de ninguna de las dos ingerido**. Como `rag/retrieve` filtra la
 * búsqueda vectorial por `version`, un usuario en una de ellas recibía cero
 * resultados en Preguntar, Voces y Sentir — sin error visible, solo "no
 * encontré contenido relevante" para siempre.
 *
 * RVR1960 y NVI son de licencia comercial y siguen sin resolver desde el
 * arranque (PRD §6, phases.md Fase 1), así que la beta sale solo con RV1909,
 * que es de dominio público. Sus literales se quedan en el schema a
 * propósito: hay filas de usuarios que ya las eligieron y no se rompen, se
 * resuelven a RV1909 al leer.
 *
 * Cuando exista corpus de otra versión, agregarla acá y a
 * `AVAILABLE_BIBLE_VERSIONS` alcanza para reactivarla en toda la app.
 */

export const DEFAULT_BIBLE_VERSION = "RV1909";

// Ingeridas y consultables hoy. RVR1960 y NVI quedan fuera hasta resolver
// licencia + corpus; sus literales siguen en el schema por las filas viejas.
// Editar esta lista es lo único que hace falta para habilitar otra versión.
export const AVAILABLE_BIBLE_VERSIONS = [DEFAULT_BIBLE_VERSION] as const;

export type BibleVersion = "RV1909" | "RVR1960" | "NVI";

export function bibleVersionIsAvailable(version: string | undefined | null): boolean {
  return (
    typeof version === "string" &&
    (AVAILABLE_BIBLE_VERSIONS as readonly string[]).includes(version)
  );
}

/**
 * Única puerta antes de tocar el índice vectorial. Una versión sin corpus
 * degrada a `DEFAULT_BIBLE_VERSION` en vez de devolver cero citas.
 */
export function resolveBibleVersion(version: string | undefined | null): string {
  return bibleVersionIsAvailable(version) ? (version as string) : DEFAULT_BIBLE_VERSION;
}
