import { devotionalCatalog } from "./devotionalCatalog";
import { fallbackFeedPhoto, FEED_POOL, type FeedPassage } from "./verseFeedCore";

/**
 * "Crear imagen" de cualquier versículo (design/oleada-ux.md §Crear imagen).
 * Lo que no toca la base: la cita canónica (la misma llave que usa el feed
 * para sus fondos de IA), qué fondos del feed ya le sirven y las fotos del
 * catálogo, en un orden fijo por cita.
 */

/** Tope de un rango: más versículos ya no entran enteros en la imagen. */
export const VERSE_IMAGE_MAX_VERSES = 6;

export type VerseImagePassage = { book: string; chapter: number; verse: number; endVerse: number | null };

/** Último versículo del rango dentro del tope, o null si es uno solo. */
export function clampEndVerse(verse: number, verseEnd: number | null | undefined): number | null {
  if (verseEnd === null || verseEnd === undefined || !Number.isInteger(verseEnd) || verseEnd <= verse) return null;
  return Math.min(verseEnd, verse + VERSE_IMAGE_MAX_VERSES - 1);
}

/** "Juan 3:16" o "Filipenses 4:6-7": la llave de `verseFeedMedia`, igual que el catálogo del feed. */
export function verseImageRef(passage: VerseImagePassage): string {
  const range = passage.endVerse === null ? "" : `-${passage.endVerse}`;
  return `${passage.book} ${passage.chapter}:${passage.verse}${range}`;
}

/**
 * Citas del feed cuyo fondo de IA le sirve a este pasaje, de la más justa a
 * la más amplia: la misma cita y después las del catálogo que la contienen
 * (Filipenses 4:6 usa el fondo de "Filipenses 4:6-7"). Así no se paga una
 * imagen nueva por algo que el feed ya ilustró.
 */
export function feedRefsCovering(passage: VerseImagePassage, pool: readonly FeedPassage[] = FEED_POOL): string[] {
  const own = verseImageRef(passage);
  const last = passage.endVerse ?? passage.verse;
  const covering = pool
    .filter(
      (item) =>
        item.ref !== own &&
        item.book === passage.book &&
        item.chapter === passage.chapter &&
        item.verse <= passage.verse &&
        (item.endVerse ?? item.verse) >= last,
    )
    .sort((a, b) => (a.endVerse ?? a.verse) - a.verse - ((b.endVerse ?? b.verse) - b.verse))
    .map((item) => item.ref);
  return [own, ...covering];
}

/** Temas del catálogo para el prompt del fondo (vacío si la cita no está en el feed). */
export function topicsFor(ref: string, pool: readonly FeedPassage[] = FEED_POOL): readonly string[] {
  return pool.find((item) => item.ref === ref)?.topics ?? [];
}

export type VerseImagePhoto = { id: string; imageUrl: string; imageAlt: string };

// Las mismas fotos de los devocionales que usa el feed mientras una cita no tiene fondo propio.
const PHOTOS: readonly VerseImagePhoto[] = [
  ...new Map(devotionalCatalog.map((item) => [item.imageUrl, item])).values(),
].map(({ imageAlt, imageUrl }, index) => ({ id: `foto-${index + 1}`, imageAlt, imageUrl }));

/**
 * Las fotos del catálogo, empezando por la que el feed le asigna a esta cita
 * (la que la persona ya pudo haber visto deslizando). Los ids son fijos para
 * que el último estilo elegido se recuerde entre versículos.
 */
export function photosFor(ref: string, photos: readonly VerseImagePhoto[] = PHOTOS): VerseImagePhoto[] {
  const first = fallbackFeedPhoto(ref).imageUrl;
  const start = Math.max(0, photos.findIndex((photo) => photo.imageUrl === first));
  return [...photos.slice(start), ...photos.slice(0, start)];
}
