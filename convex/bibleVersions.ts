/**
 * Qué versiones de la Biblia están realmente disponibles — #93 §4b.
 *
 * `users.bibleVersion` acepta "NVI" en el schema, pero **no hay corpus NVI
 * ingerido**. Como `rag/retrieve` filtra la búsqueda vectorial por `version`,
 * un usuario en NVI recibía cero resultados en Preguntar, Voces y Sentir —
 * sin error visible, solo "no encontré contenido relevante" para siempre.
 *
 * La licencia de NVI está sin resolver desde el arranque (PRD §6, phases.md
 * Fase 1), así que la beta sale solo con RVR1960. El literal "NVI" se queda
 * en el schema a propósito: hay filas de usuarios que ya la eligieron y no se
 * rompen: se resuelven a RVR1960 al leer.
 *
 * Cuando exista corpus NVI, agregarla acá y a `AVAILABLE_BIBLE_VERSIONS`
 * alcanza para reactivarla en toda la app.
 */

export const DEFAULT_BIBLE_VERSION = "RVR1960";

// Ingeridas y consultables hoy. NVI queda fuera hasta resolver licencia + corpus.
export const AVAILABLE_BIBLE_VERSIONS = [DEFAULT_BIBLE_VERSION] as const;

export type BibleVersion = "RVR1960" | "NVI";

export function bibleVersionIsAvailable(version: string | undefined | null): boolean {
  return (
    typeof version === "string" &&
    (AVAILABLE_BIBLE_VERSIONS as readonly string[]).includes(version)
  );
}

/**
 * Única puerta antes de tocar el índice vectorial. Una versión sin corpus
 * degrada a RVR1960 en vez de devolver cero citas.
 */
export function resolveBibleVersion(version: string | undefined | null): string {
  return bibleVersionIsAvailable(version) ? (version as string) : DEFAULT_BIBLE_VERSION;
}
