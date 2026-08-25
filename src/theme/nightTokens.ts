import { tokens } from "./tokens";

/**
 * Soft night palette measured from `isHomeDark` in
 * `design/Bible AI Honduras.dc.html` (~740–774). Same keys as `tokens.color`
 * so screens can swap palettes without hex literals.
 *
 * Frozen files `design/tokens.json` and `src/theme/tokens.ts` are not edited
 * (Track C). These values are not in the light token file yet — that is a
 * finding for the design re-export, not a license to invent hexes in UI.
 */
export const nightTokens = {
  color: {
    ink: "#EDE6DA",
    inkMuted: "#8E857A",
    inkSoft: "#7A7269",
    inkFaint: "#5F5A53",
    bg: "#211F1D",
    surface: "#292522",
    surfaceAlt: "#282522",
    surfaceSunk: "#252220",
    border: "#34302B",
    borderStrong: "#33302C",
    accent: "#C99B5E",
    accentDeep: tokens.color.accentDeep,
    sage: "#8FA48D",
  },
} as const;

export type ThemeColor = typeof tokens.color | typeof nightTokens.color;
