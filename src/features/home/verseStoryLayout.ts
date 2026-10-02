import { tokens } from "../../theme/tokens";

/**
 * Layout de la imagen 9:16 del versículo del día (#161, design/oleada-ux.md
 * §U2). Todo en píxeles de salida (1080×1920): la tarjeta se dibuja a escala
 * de pantalla y se captura al tamaño final.
 *
 * El tamaño de letra baja de `verseMax` a `verseMin` según el largo del
 * versículo, hasta que entra en el espacio del medio. Si ni en `verseMin`
 * entra (versículos muy largos), se corta con `maxLines`.
 */

type StoryImageTokens = typeof tokens.storyImage;

export type VerseStoryLayout = {
  /** Tamaño del versículo, en píxeles de salida. */
  fontSize: number;
  lineHeight: number;
  /** Renglones estimados con ese tamaño. */
  lines: number;
  /** Tope de renglones para `numberOfLines`. */
  maxLines: number;
  /** El texto no entra entero ni en `verseMin`. */
  truncated: boolean;
};

// Ancho medio de un carácter de EB Garamond, en "em". Es una estimación
// conservadora (la serif es angosta): mejor achicar de más que cortar.
const SERIF_CHAR_WIDTH_EM = 0.46;
// Paso con el que se prueba cada tamaño, de mayor a menor.
const FONT_STEP = 2;
// Lo que ocupan la cita y la marca debajo del versículo, en múltiplos de su
// tamaño: cita (1 renglón + aire) y marca (logo + nombre + aire).
const REFERENCE_BLOCK_EM = 3;
const BRAND_BLOCK_EM = 4;
// Con temporada (#199), su nombre arriba: un renglón + aire, en múltiplos de su tamaño.
const SEASON_BLOCK_EM = 2;

export type VerseStoryOptions = {
  /** Hay temporada activa: su nombre ocupa la franja de arriba. */
  withSeason?: boolean;
};

/** Renglones que ocupa `text` partiendo por palabras con `charsPerLine` caracteres. */
export function estimateLines(text: string, charsPerLine: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const width = Math.max(1, Math.floor(charsPerLine));
  let lines = 1;
  let current = 0;
  for (const word of words) {
    // Una palabra más larga que el renglón ocupa los renglones que haga falta.
    const length = word.length;
    if (current === 0) {
      lines += Math.ceil(length / width) - 1;
      current = length % width || width;
    } else if (current + 1 + length <= width) {
      current += 1 + length;
    } else {
      lines += Math.ceil(length / width);
      current = length % width || width;
    }
  }
  return lines;
}

/** Alto disponible para el versículo, descontando márgenes, cita, marca y, si hay, la temporada. */
export function verseAreaHeight(image: StoryImageTokens = tokens.storyImage, options: VerseStoryOptions = {}): number {
  const season = options.withSeason ? image.season * SEASON_BLOCK_EM : 0;
  return image.height - image.paddingY * 2 - image.reference * REFERENCE_BLOCK_EM - image.brand * BRAND_BLOCK_EM - season;
}

export function verseStoryLayout(
  text: string,
  image: StoryImageTokens = tokens.storyImage,
  options: VerseStoryOptions = {},
): VerseStoryLayout {
  const availableWidth = image.width - image.paddingX * 2;
  const availableHeight = verseAreaHeight(image, options);

  const measure = (fontSize: number) => {
    const lineHeight = Math.round(fontSize * image.verseLineHeight);
    const lines = estimateLines(text, availableWidth / (fontSize * SERIF_CHAR_WIDTH_EM));
    return { fontSize, lineHeight, lines, maxLines: Math.max(1, Math.floor(availableHeight / lineHeight)) };
  };

  for (let fontSize = image.verseMax; fontSize >= image.verseMin; fontSize -= FONT_STEP) {
    const candidate = measure(fontSize);
    if (candidate.lines * candidate.lineHeight <= availableHeight) {
      return { ...candidate, truncated: false };
    }
  }

  const smallest = measure(image.verseMin);
  return { ...smallest, truncated: smallest.lines > smallest.maxLines };
}

/**
 * Medidas fijas de la imagen (marca y aire), en píxeles de salida. Salen del
 * tamaño de la marca y de la cita (`storyImage`), no de números sueltos.
 */
export function storyChrome(image: StoryImageTokens = tokens.storyImage) {
  return {
    logoSize: image.brand * 2,
    brandGap: image.brand / 2,
    referenceGap: image.reference,
    // Temporada (#199): el renglón del nombre y el espaciado de `overline`, en proporción.
    seasonLineHeight: image.season * image.verseLineHeight,
    seasonLetterSpacing: image.season * tokens.type.overline.letterSpacing,
  };
}

/**
 * Tamaño que se le pide a `captureRef` para que el PNG salga en 1080×1920.
 * iOS lo toma en puntos y lo multiplica por la densidad de la pantalla;
 * Android (y web) lo toman en píxeles.
 */
export function storyCaptureSize(os: string, pixelRatio: number, image: StoryImageTokens = tokens.storyImage) {
  const divisor = os === "ios" && pixelRatio > 0 ? pixelRatio : 1;
  return { width: image.width / divisor, height: image.height / divisor };
}
