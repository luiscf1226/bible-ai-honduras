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
    sage: "#7C8F7B"
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
