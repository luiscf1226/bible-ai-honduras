import { isSeasonPalette, type SeasonPaletteName } from "../../theme/seasonPalette";
import { tokens } from "../../theme/tokens";

/**
 * Guirnalda de temporada (design/oleada-ux.md §Decoración de temporada): qué
 * adornos cuelgan del cordel en cada paleta. Solo datos: `SeasonGarland` los
 * dibuja. Cada adorno vive en una grilla de 24 centrada en (0, 0) y se ubica
 * sobre un lienzo de `GARLAND_WIDTH` × `tokens.size.seasonGarland`.
 *
 * Línea de producto: nada de Halloween. Las calabazas son de cosecha (sin
 * caras), y en Navidad la estrella es la de Belén.
 */

export const GARLAND_WIDTH = 320;
export const GARLAND_HEIGHT = tokens.size.seasonGarland;

export type Motif =
  | "leaf"
  | "pumpkin"
  | "flower"
  | "wheat"
  | "poinsettia"
  | "pine"
  | "ornament"
  | "holly"
  | "star"
  | "sparkle"
  | "olive";

export type DecorTone = keyof (typeof tokens.seasonDecor)[SeasonPaletteName]["day"];

export type Ornament = {
  motif: Motif;
  x: number;
  y: number;
  /** 1 = grilla de 24. */
  scale?: number;
  rotate?: number;
  tone: DecorTone;
};

export type Garland = {
  /** Cordel del que cuelga todo; `null` si la temporada no lleva. */
  cord: string | null;
  ornaments: readonly Ornament[];
};

/** Cordel que cae suave entre dos clavos, como una guirnalda colgada. */
const SWAG = "M0 10 Q80 34 160 16 T320 12";

const GARLANDS: Record<SeasonPaletteName, Garland> = {
  // Octubre: otoño. Hojas que caen, calabazas y flores.
  reforma: {
    cord: SWAG,
    ornaments: [
      { motif: "leaf", x: 14, y: 16, rotate: -40, tone: "warm" },
      { motif: "flower", x: 40, y: 24, scale: 0.8, tone: "gold" },
      { motif: "leaf", x: 62, y: 30, rotate: 25, tone: "gold" },
      { motif: "pumpkin", x: 92, y: 36, scale: 1.1, tone: "warm" },
      { motif: "leaf", x: 122, y: 28, rotate: -15, tone: "deep" },
      { motif: "flower", x: 146, y: 20, scale: 0.9, tone: "warm" },
      { motif: "leaf", x: 170, y: 20, rotate: 50, tone: "warm" },
      { motif: "leaf", x: 196, y: 26, rotate: -30, tone: "gold" },
      { motif: "pumpkin", x: 226, y: 32, scale: 0.9, tone: "gold" },
      { motif: "flower", x: 254, y: 20, scale: 0.75, tone: "gold" },
      { motif: "leaf", x: 278, y: 16, rotate: 35, tone: "deep" },
      { motif: "leaf", x: 304, y: 18, rotate: -55, tone: "warm" },
    ],
  },
  // Noviembre: cosecha y gratitud. Trigo, calabazas y flores.
  gratitud: {
    cord: SWAG,
    ornaments: [
      { motif: "wheat", x: 16, y: 22, rotate: -20, tone: "gold" },
      { motif: "leaf", x: 40, y: 24, rotate: 30, tone: "warm" },
      { motif: "pumpkin", x: 70, y: 34, tone: "warm" },
      { motif: "flower", x: 100, y: 30, scale: 0.85, tone: "gold" },
      { motif: "wheat", x: 126, y: 26, rotate: 15, tone: "gold" },
      { motif: "pumpkin", x: 158, y: 30, scale: 1.2, tone: "gold" },
      { motif: "leaf", x: 188, y: 22, rotate: -35, tone: "leaf" },
      { motif: "flower", x: 212, y: 22, scale: 0.8, tone: "warm" },
      { motif: "wheat", x: 238, y: 22, rotate: -10, tone: "gold" },
      { motif: "pumpkin", x: 268, y: 26, scale: 0.85, tone: "warm" },
      { motif: "leaf", x: 300, y: 16, rotate: 40, tone: "gold" },
    ],
  },
  // Diciembre: Navidad. Pino, esferas, flor de pascua y la estrella de Belén.
  adviento: {
    cord: SWAG,
    ornaments: [
      { motif: "pine", x: 18, y: 14, scale: 1.2, rotate: 16, tone: "leaf" },
      { motif: "ornament", x: 42, y: 36, scale: 0.8, tone: "warm" },
      { motif: "pine", x: 66, y: 24, scale: 1.2, rotate: 12, tone: "leaf" },
      { motif: "holly", x: 96, y: 30, tone: "warm" },
      { motif: "ornament", x: 116, y: 42, scale: 0.75, tone: "gold" },
      { motif: "pine", x: 130, y: 23, scale: 1.1, rotate: -4, tone: "leaf" },
      { motif: "poinsettia", x: 160, y: 20, scale: 1.15, tone: "warm" },
      { motif: "pine", x: 190, y: 19, scale: 1.1, rotate: -8, tone: "leaf" },
      { motif: "ornament", x: 204, y: 38, scale: 0.75, tone: "gold" },
      { motif: "holly", x: 224, y: 22, rotate: 10, tone: "warm" },
      { motif: "pine", x: 254, y: 16, scale: 1.2, rotate: -6, tone: "leaf" },
      { motif: "ornament", x: 278, y: 30, scale: 0.8, tone: "warm" },
      { motif: "pine", x: 302, y: 13, scale: 1.2, rotate: -3, tone: "leaf" },
      // La estrella de Belén cuelga al centro, debajo de la flor de pascua.
      { motif: "star", x: 160, y: 46, scale: 0.6, tone: "gold" },
    ],
  },
  // Enero: "Tu versículo del año". Sin cordel: destellos de madrugada y un ramo de olivo.
  "anio-nuevo": {
    cord: null,
    ornaments: [
      { motif: "sparkle", x: 24, y: 18, scale: 0.7, tone: "gold" },
      { motif: "star", x: 56, y: 36, scale: 0.45, tone: "warm" },
      { motif: "sparkle", x: 90, y: 22, scale: 1, tone: "gold" },
      { motif: "olive", x: 132, y: 30, rotate: -60, tone: "leaf" },
      { motif: "sparkle", x: 160, y: 22, scale: 1.3, tone: "gold" },
      { motif: "olive", x: 188, y: 30, rotate: 60, tone: "leaf" },
      { motif: "sparkle", x: 230, y: 24, scale: 0.9, tone: "gold" },
      { motif: "star", x: 262, y: 38, scale: 0.4, tone: "warm" },
      { motif: "sparkle", x: 296, y: 18, scale: 0.7, tone: "gold" },
    ],
  },
};

/** La guirnalda de la paleta, o null si la temporada no tiene paleta conocida. */
export function garlandFor(paletteKey: string | null | undefined): Garland | null {
  return isSeasonPalette(paletteKey) ? GARLANDS[paletteKey] : null;
}

/** Tonos de la guirnalda para día o noche. */
export function decorTones(paletteKey: SeasonPaletteName, dark: boolean) {
  return tokens.seasonDecor[paletteKey][dark ? "night" : "day"];
}
