import { tokens, type ThemeColor } from "./tokens";

/**
 * Capa de temporada (#199, design/oleada-ux.md §Temporadas). El servidor
 * (`seasons.current`) manda solo el *nombre* de la paleta; el tono vive en
 * `tokens.season`. Este es el único lugar donde se resuelve: ningún componente
 * elige colores de temporada por su cuenta.
 */

export type SeasonPaletteName = keyof typeof tokens.season;

/** Las únicas llaves que una temporada puede pisar. El texto queda igual: su contraste ya está medido. */
export const SEASON_COLOR_KEYS = ["accent", "accentDeep", "bg", "surfaceSunk"] as const;

export function isSeasonPalette(name: string | null | undefined): name is SeasonPaletteName {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(tokens.season, name);
}

/**
 * Paleta final: día o noche, y encima la temporada si el nombre existe.
 * Sin temporada (o con un nombre desconocido) devuelve la paleta de siempre,
 * el mismo objeto: la app se ve exactamente como sin temporadas.
 */
export function resolvePalette({ dark, paletteKey }: { dark: boolean; paletteKey?: string | null }): ThemeColor {
  const base: ThemeColor = dark ? tokens.night.color : tokens.color;
  if (!isSeasonPalette(paletteKey)) return base;

  const layer = tokens.season[paletteKey][dark ? "night" : "day"];
  const merged: { -readonly [K in keyof ThemeColor]: string } = { ...base };
  for (const key of SEASON_COLOR_KEYS) merged[key] = layer[key];
  return merged;
}
