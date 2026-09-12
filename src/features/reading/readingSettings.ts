import { tokens } from "../../theme/tokens";

/**
 * Controles de lectura del lector (#113).
 *
 * Regla dura #1: acá no se declara ningún tamaño de fuente nuevo. La base es
 * `tokens.type.versePicker` — el mismo token con el que ya se pinta el texto
 * bíblico en el selector de pasaje de Preguntar — y los pasos son **factores**
 * sobre ese token, no valores absolutos. Subir la letra escala el token; no lo
 * reemplaza por un número inventado.
 */
export const READING_BASE_TYPE = tokens.type.versePicker;

/** Factores del tamaño de letra. El paso 1 es exactamente el token. */
export const READING_FONT_SCALES = [0.85, 1, 1.2, 1.45] as const;

/** Factores del interlineado sobre el lineHeight del mismo token. */
export const READING_LINE_SPACINGS = [0.9, 1, 1.15] as const;

export const READING_FONT_LABELS = ["A pequeña", "A normal", "A grande", "A muy grande"] as const;
export const READING_SPACING_LABELS = ["Compacto", "Normal", "Amplio"] as const;

/** Paso por defecto: el token tal cual, interlineado tal cual. */
export const DEFAULT_FONT_STEP = 1;
export const DEFAULT_SPACING_STEP = 1;

export function clampStep(step: number | undefined | null, length: number, fallback: number): number {
  if (typeof step !== "number" || !Number.isInteger(step)) {
    return fallback;
  }
  return Math.min(Math.max(step, 0), length - 1);
}

export function clampFontStep(step: number | undefined | null): number {
  return clampStep(step, READING_FONT_SCALES.length, DEFAULT_FONT_STEP);
}

export function clampSpacingStep(step: number | undefined | null): number {
  return clampStep(step, READING_LINE_SPACINGS.length, DEFAULT_SPACING_STEP);
}

export type ReadingTypeStyle = {
  fontSize: number;
  lineHeight: number;
};

/** Tipografía resultante del par (tamaño, interlineado) elegido. */
export function readingTypeStyle(fontStep: number, spacingStep: number): ReadingTypeStyle {
  const scale = READING_FONT_SCALES[clampFontStep(fontStep)];
  const spacing = READING_LINE_SPACINGS[clampSpacingStep(spacingStep)];
  return {
    fontSize: READING_BASE_TYPE.size * scale,
    lineHeight: READING_BASE_TYPE.lineHeight * scale * spacing,
  };
}

/** Siguiente paso con tope, para los botones + / − (no dan la vuelta). */
export function stepTowards(current: number, direction: 1 | -1, length: number): number {
  return Math.min(Math.max(current + direction, 0), length - 1);
}
