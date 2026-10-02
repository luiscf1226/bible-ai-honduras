import type { SeasonPaletteName } from "../../theme/seasonPalette";
import { isSeasonPalette } from "../../theme/seasonPalette";

/**
 * Copy de la franja de temporada del inicio (#199, design/oleada-ux.md
 * §Temporadas): el nombre viene del servidor; la línea de abajo es curada,
 * una por paleta, sin IA. Una temporada con paleta nueva (o sin paleta)
 * muestra sus fechas mientras no tenga línea propia.
 */
export const SEASON_LINES: Record<SeasonPaletteName, string> = {
  reforma: "Solo la Escritura: un mes para volver a la Palabra.",
  gratitud: "Un mes para dar gracias, con los Salmos en la mano.",
  adviento: "Preparamos el corazón para celebrar que Jesús vino.",
};

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function parts(dateKey: string): { day: number; month: string } | null {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const month = MONTHS[Number(match[1]) - 1];
  const day = Number(match[2]);
  return month && day > 0 ? { day, month } : null;
}

/** "Del 1 al 31 de octubre" / "Del 29 de marzo al 5 de abril". */
export function seasonDateRange(startDate: string, endDate: string): string | null {
  const start = parts(startDate);
  const end = parts(endDate);
  if (!start || !end) return null;
  if (start.month === end.month) return `Del ${start.day} al ${end.day} de ${end.month}`;
  return `Del ${start.day} de ${start.month} al ${end.day} de ${end.month}`;
}

type SeasonLike = { paletteKey: string | null; startDate: string; endDate: string };

/** La línea `bodySm` debajo del nombre de la temporada. */
export function seasonLine(season: SeasonLike): string | null {
  if (isSeasonPalette(season.paletteKey)) return SEASON_LINES[season.paletteKey];
  return seasonDateRange(season.startDate, season.endDate);
}
