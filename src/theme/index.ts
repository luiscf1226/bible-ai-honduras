import { designTokens } from "./tokens.generated";

export { designTokens } from "./tokens.generated";

const fontFamilies = {
  serif: "EBGaramond_400Regular",
  sans: "DMSans_400Regular",
  sansLight: "DMSans_300Light",
  sansMedium: "DMSans_500Medium"
} as const;

const type = {
  display: {
    fontFamily: fontFamilies.serif,
    lineHeight: designTokens.type.display.size * designTokens.type.display.lineHeight,
    size: designTokens.type.display.size
  },
  title: {
    fontFamily: fontFamilies.serif,
    lineHeight: designTokens.type.title.size * designTokens.type.title.lineHeight,
    size: designTokens.type.title.size
  },
  verse: {
    fontFamily: fontFamilies.serif,
    lineHeight: designTokens.type.verse.size * designTokens.type.verse.lineHeight,
    size: designTokens.type.verse.size
  },
  subtitle: {
    fontFamily: fontFamilies.serif,
    lineHeight: designTokens.type.subtitle.size * designTokens.type.subtitle.lineHeight,
    size: designTokens.type.subtitle.size
  },
  body: {
    fontFamily: fontFamilies.sansLight,
    lineHeight: designTokens.type.body.size * designTokens.type.body.lineHeight,
    size: designTokens.type.body.size
  },
  bodySm: {
    fontFamily: fontFamilies.sansLight,
    lineHeight: designTokens.type.bodySm.size * designTokens.type.bodySm.lineHeight,
    size: designTokens.type.bodySm.size
  },
  label: {
    fontFamily: fontFamilies.sans,
    lineHeight: designTokens.type.label.size * designTokens.type.label.lineHeight,
    size: designTokens.type.label.size
  },
  caption: {
    fontFamily: fontFamilies.sansLight,
    lineHeight: designTokens.type.caption.size * designTokens.type.caption.lineHeight,
    size: designTokens.type.caption.size
  },
  overline: {
    fontFamily: fontFamilies.sansLight,
    letterSpacing: designTokens.type.overline.letterSpacing,
    lineHeight: designTokens.type.overline.size * designTokens.type.overline.lineHeight,
    size: designTokens.type.overline.size
  }
} as const;

/** Tokens de uso diario para React Native, derivados de `design/tokens.json`. */
export const tokens = {
  ...designTokens,
  font: fontFamilies,
  type
} as const;

export const typography = type;

export type ColorToken = keyof typeof designTokens.color;
export type TypographyToken = keyof typeof typography;

/** Punto de acceso estable para componentes y pantallas. */
export function useTheme() {
  return tokens;
}
