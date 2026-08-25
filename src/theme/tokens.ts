/**
 * Puente nativo del contrato visual en design/tokens.json.
 * Los valores adicionales de tamaño se midieron en el prototipo exportado.
 */
export const tokens = {
  color: {
    ink: "#3B352E",
    inkMuted: "#8E857A",
    inkSoft: "#A09789",
    inkFaint: "#BDB4A6",
    bg: "#E9E1D5",
    surface: "#FBF8F3",
    surfaceAlt: "#FAF5EE",
    surfaceSunk: "#F4EFE6",
    border: "#EDE6DA",
    borderStrong: "#E8E1D6",
    accent: "#B08260",
    accentDeep: "#8C6A4C",
    sage: "#7C8F7B",
    danger: "#B0603F",
  },
  night: {
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
      accentDeep: "#8C6A4C",
      sage: "#8FA48D",
      danger: "#B0603F",
    },
  },
  paywall: {
    color: {
      bgStart: "#3B352E",
      bgMid: "#2E2A25",
      bgEnd: "#252220",
      title: "#FBF8F3",
      muted: "#B7AEA1",
      mutedDeep: "#9C9488",
      check: "#C99B5E",
      button: "#F4EDE2",
      buttonInk: "#2E2A25",
      skip: "#8B8377",
      legal: "#6E675E",
      closeBorder: "rgba(251,248,243,0.2)",
      featureRule: "rgba(251,248,243,0.09)",
      priceBorder: "rgba(201,155,94,0.45)",
      priceFill: "rgba(201,155,94,0.09)",
    },
    type: {
      headline: { size: 31, lineHeight: 40 },
      price: { size: 34, lineHeight: 34 },
      feature: { size: 16.5, lineHeight: 22 },
    },
  },
  font: {
    serif: "EBGaramond_400Regular",
    sans: "DMSans_400Regular",
    sansLight: "DMSans_300Light",
    sansMedium: "DMSans_500Medium"
  },
  type: {
    display: { size: 38, lineHeight: 38 },
    title: { size: 25, lineHeight: 33 },
    verse: { size: 22, lineHeight: 27 },
    subtitle: { size: 19, lineHeight: 27 },
    body: { size: 14.5, lineHeight: 26 },
    bodySm: { size: 13.5, lineHeight: 23 },
    label: { size: 14.5, lineHeight: 15 },
    caption: { size: 11.5, lineHeight: 17 },
    overline: { size: 10.5, lineHeight: 11, letterSpacing: 0.16 }
  },
  opacity: { pressed: 0.9 },
  radius: { sm: 11, md: 14, lg: 16, xl: 18, xxl: 22, pill: 999 },
  space: { xs: 6, sm: 9, md: 12, lg: 14, xl: 20, xxl: 22 },
  cardPadding: { vertical: 16, horizontal: 18 },
  size: { logoLarge: 96, logoMedium: 76, logoSmall: 38, dot: 6, dotActive: 22, avatar: 48 }
} as const;

// Ambas paletas (día y noche) comparten llaves; el tipo se ensancha a string
// para que un componente pueda recibir cualquiera de las dos sin atarse a los
// literales de la paleta clara.
export type ThemeColor = { readonly [K in keyof typeof tokens.color]: string };
