import type { HighlightColor } from "../../../convex/reading";
import type { ThemeColor } from "../../theme/tokens";

export type { HighlightColor };

/**
 * Colores del subrayado (#168). La llave es la que se guarda en
 * `readingHighlights.color`; el tono sale siempre del tema activo, así el mismo
 * subrayado se lee en claro y en oscuro.
 */
type HighlightSwatch = {
  key: HighlightColor;
  label: string;
  /** Fondo translúcido detrás del texto del versículo. */
  fill: keyof ThemeColor;
  /** Punto sólido del selector de color. */
  swatch: keyof ThemeColor;
};

export const HIGHLIGHT_SWATCHES: readonly HighlightSwatch[] = [
  { key: "amber", label: "Ámbar", fill: "highlightAmber", swatch: "accent" },
  { key: "sage", label: "Salvia", fill: "highlightSage", swatch: "sage" },
  { key: "clay", label: "Barro", fill: "highlightClay", swatch: "danger" },
  { key: "sand", label: "Arena", fill: "highlightSand", swatch: "inkFaint" },
];

function swatchFor(key: HighlightColor): HighlightSwatch {
  return HIGHLIGHT_SWATCHES.find((item) => item.key === key) ?? HIGHLIGHT_SWATCHES[0];
}

export function highlightFill(color: ThemeColor, key: HighlightColor): string {
  return color[swatchFor(key).fill];
}

export function highlightSwatch(color: ThemeColor, key: HighlightColor): string {
  return color[swatchFor(key).swatch];
}
