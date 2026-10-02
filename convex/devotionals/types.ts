/**
 * Una entrada del devocional diario: un día del calendario (mes-día), no un
 * día de un ciclo. Los cinco campos de texto son la estructura que pinta `/hoy`
 * (#194): Oración inicial · Introducción · Pasaje · Reflexión · Oración final.
 *
 * Reglas del contenido (las verifica `convex/devotionalCatalog.test.ts`):
 * - Sin texto bíblico citado: el pasaje se resuelve contra el corpus por
 *   `verseRef`, en la versión de la persona (regla dura #4).
 * - Jesús, Dios y el Espíritu Santo nunca hablan en 1ra persona; se habla de
 *   ellos en 3ra persona (regla dura #2).
 * - `verseRef` usa el nombre del libro tal como está en el corpus
 *   (`BIBLE_BOOKS` en `src/lib/bibleBooks.ts`) y un solo versículo o un rango
 *   dentro del mismo capítulo ("Lamentaciones 3:22-23").
 */
export type DevotionalEntry = {
  /** Día del mes, 1-indexado. Tiene que coincidir con la posición en el arreglo. */
  day: number;
  /** Oración inicial breve, 1–2 oraciones. */
  openingPrayer: string;
  /** Introducción que prepara el pasaje, 2–3 oraciones. */
  intro: string;
  /** Pasaje del día: un versículo o un rango corto del mismo capítulo. */
  verseRef: string;
  /** Reflexión sobre el pasaje, 2–4 oraciones. */
  reflection: string;
  /** Oración final, 2–3 oraciones, termina en "Amén." */
  closingPrayer: string;
};
