import type { VerseImagePhoto } from "../../../convex/verseImageCore";
import { findBook } from "../../lib/bibleBooks";
import { limitBodyFor } from "../../lib/limitCopy";
import { storyPalettes, type StoryPalette, type StoryPaletteId, type StorySeason } from "../home/storyPalettes";
import type { StoryFormat, StoryLayout } from "../home/verseStoryLayout";

/**
 * "Crear imagen" de cualquier versículo (design/oleada-ux.md §Crear imagen):
 * partes puras, sin React Native. La pantalla vive en `app/imagen.tsx`.
 */

export const AI_BACKGROUND_ID = "ia";

export type VerseImageBackground =
  | { kind: "color"; id: StoryPaletteId; label: string; palette: StoryPalette }
  | { kind: "photo"; id: string; label: string; imageUrl: string; imageAlt: string };

/** Lo que se recuerda entre versículos (último estilo elegido). */
export type VerseImageStyle = { background: string | null; layout: StoryLayout; format: StoryFormat };

export const VERSE_IMAGE_STYLE_KEY = "verseImage/style";

export const VERSE_IMAGE_LAYOUTS: readonly { id: StoryLayout; label: string }[] = [
  { id: "classic", label: "Clásica" },
  { id: "poster", label: "Póster" },
  { id: "minimal", label: "Minimal" },
];

export const VERSE_IMAGE_FORMATS: readonly { id: StoryFormat; label: string }[] = [
  { id: "story", label: "Estado · 9:16" },
  { id: "square", label: "Cuadrado" },
];

const PALETTE_LABELS: Record<Exclude<StoryPaletteId, "temporada">, string> = {
  clasica: "Papel",
  noche: "Noche",
  arena: "Arena",
};

/**
 * Los fondos del carrusel, en orden: el de IA (si la cita ya tiene), las
 * fotos del catálogo y los colores lisos (los mismos de "Dedicar").
 */
export function composerBackgrounds(params: {
  aiImageUrl: string | null;
  photos: readonly VerseImagePhoto[];
  season?: StorySeason;
}): VerseImageBackground[] {
  const ai: VerseImageBackground[] = params.aiImageUrl
    ? [{ kind: "photo", id: AI_BACKGROUND_ID, label: "Con IA", imageUrl: params.aiImageUrl, imageAlt: "Fondo pintado con IA para este versículo" }]
    : [];
  const photos = params.photos.map(
    (photo, index): VerseImageBackground => ({ kind: "photo", label: `Foto ${index + 1}`, ...photo }),
  );
  const colors = storyPalettes(params.season).map(
    ({ id, palette }): VerseImageBackground => ({
      kind: "color",
      id,
      label: id === "temporada" ? (params.season?.name ?? "") : PALETTE_LABELS[id],
      palette,
    }),
  );
  return [...ai, ...photos, ...colors];
}

/**
 * El fondo a mostrar: el que eligió la persona si existe para esta cita; si
 * no, el de IA; si no, la primera foto. Así abre siempre con algo bonito.
 */
export function chooseBackground(
  wanted: string | null | undefined,
  backgrounds: readonly VerseImageBackground[],
): VerseImageBackground | null {
  return (
    backgrounds.find((item) => item.id === wanted) ??
    backgrounds.find((item) => item.id === AI_BACKGROUND_ID) ??
    backgrounds.find((item) => item.kind === "photo") ??
    backgrounds[0] ??
    null
  );
}

export const DEFAULT_VERSE_IMAGE_STYLE: VerseImageStyle = { background: null, layout: "classic", format: "story" };

/** Lee el estilo guardado; cualquier cosa rara vuelve al de siempre, campo por campo. */
export function parseSavedStyle(raw: string | null | undefined): VerseImageStyle {
  if (!raw) return DEFAULT_VERSE_IMAGE_STYLE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_VERSE_IMAGE_STYLE;
  }
  if (!data || typeof data !== "object") return DEFAULT_VERSE_IMAGE_STYLE;
  const record = data as Record<string, unknown>;
  return {
    background: typeof record.background === "string" ? record.background : null,
    layout: VERSE_IMAGE_LAYOUTS.some((item) => item.id === record.layout)
      ? (record.layout as StoryLayout)
      : DEFAULT_VERSE_IMAGE_STYLE.layout,
    format: VERSE_IMAGE_FORMATS.some((item) => item.id === record.format)
      ? (record.format as StoryFormat)
      : DEFAULT_VERSE_IMAGE_STYLE.format,
  };
}

export type VerseImagePassage = { book: string; chapter: number; verse: number; verseEnd: number | null };

type RawParam = string | string[] | undefined;

const first = (value: RawParam) => (Array.isArray(value) ? value[0] : value);

const positiveInt = (value: RawParam) => {
  const raw = first(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : undefined;
};

/** Params de `/imagen`. Un libro o capítulo inválido es null; un `verseEnd` inválido es un solo versículo. */
export function readVerseImageParams(raw: {
  book?: RawParam;
  chapter?: RawParam;
  verse?: RawParam;
  verseEnd?: RawParam;
}): VerseImagePassage | null {
  const bookName = first(raw.book);
  const book = bookName ? findBook(bookName) : null;
  const chapter = positiveInt(raw.chapter);
  const verse = positiveInt(raw.verse);
  if (!book || chapter === undefined || verse === undefined || chapter > book.chapters) return null;
  const end = positiveInt(raw.verseEnd);
  return { book: book.name, chapter, verse, verseEnd: end !== undefined && end > verse ? end : null };
}

/** "Filipenses 4:6-7": con el final que de verdad trajo el corpus. */
export function verseImageReference(passage: { book: string; chapter: number; verse: number }, endVerse: number | null): string {
  return `${passage.book} ${passage.chapter}:${passage.verse}${endVerse ? `-${endVerse}` : ""}`;
}

/**
 * Texto que acompaña la imagen (corto: la imagen ya lo dice todo).
 * `shareImage` le agrega el link con el código de invitación.
 */
export function buildVerseImageShareText(params: { reference: string; version: string }): string {
  return `${params.reference} (${params.version})`;
}

export type AiNotice = "limit" | "no_credit" | "failed" | "busy" | null;

/** Qué decirle a la persona cuando el fondo con IA no salió. Nunca bloquea compartir. */
export function aiNoticeText(notice: AiNotice): string | null {
  if (notice === "limit") return limitBodyFor("verseImage");
  if (notice === "no_credit") return "Los fondos con IA no están disponibles por ahora. Elegí una foto o un color: quedan igual de bonitos.";
  if (notice === "failed") return "No pudimos pintar el fondo esta vez. Probá de nuevo en un rato o elegí una foto.";
  if (notice === "busy") return "Ya se está pintando un fondo para este versículo: aparece acá en un momento.";
  return null;
}
