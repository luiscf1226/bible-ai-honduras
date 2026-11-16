import { tokens } from "../../theme/tokens";

/**
 * Fondos lisos de la imagen del versículo: los comparten "Dedicar" (#202,
 * como plantillas) y "Crear imagen" (design/oleada-ux.md §Crear imagen).
 * Todos salen de la paleta (`tokens`), nunca un hex suelto.
 */
export type StoryPalette = {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
};

export type StoryPaletteId = "clasica" | "noche" | "temporada" | "arena";

export type StoryPaletteOption = { id: StoryPaletteId; palette: StoryPalette };

type SeasonKey = keyof typeof tokens.season;

export type StorySeason = { name: string; paletteKey?: string | null } | null | undefined;

function isSeasonKey(key: string | null | undefined): key is SeasonKey {
  return typeof key === "string" && key in tokens.season;
}

/**
 * Papel y Noche siempre; la de la temporada activa (#199) solo mientras dura,
 * con su acento; Arena (`surfaceSunk` con `sage`) siempre.
 */
export function storyPalettes(season?: StorySeason): StoryPaletteOption[] {
  const day = tokens.color;
  const night = tokens.night.color;
  const palettes: StoryPaletteOption[] = [
    { id: "clasica", palette: { bg: day.paper, ink: day.ink, muted: day.inkMuted, accent: day.accent } },
    { id: "noche", palette: { bg: night.bg, ink: night.ink, muted: night.inkMuted, accent: night.accent } },
  ];
  if (season && isSeasonKey(season.paletteKey)) {
    const layer = tokens.season[season.paletteKey].day;
    palettes.push({ id: "temporada", palette: { bg: layer.bg, ink: day.ink, muted: day.inkMuted, accent: layer.accent } });
  }
  palettes.push({ id: "arena", palette: { bg: day.surfaceSunk, ink: day.ink, muted: day.inkMuted, accent: day.sage } });
  return palettes;
}
