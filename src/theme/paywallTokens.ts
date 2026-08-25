import { tokens } from "./tokens";

/**
 * Paywall palette and type measured from `isPaywall` in
 * `design/Bible AI Honduras.dc.html` (~564–592).
 * Frozen `design/tokens.json` / `src/theme/tokens.ts` are not edited.
 */
export const paywallTokens = {
  color: {
    bgStart: tokens.color.ink,
    bgMid: "#2E2A25",
    bgEnd: "#252220",
    title: tokens.color.surface,
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
} as const;

export const PAYWALL_FEATURES = [
  { subtitle: "Q&A guiado y pregunta libre, todo el día", title: "Preguntas sin contar" },
  { subtitle: "Sin cortes a media conversación", title: "Conversaciones largas con los personajes" },
  { subtitle: "Cada vez que lo necesites, no dos al día", title: "Devocionales para lo que estés viviendo" },
  { subtitle: "Cualquier pasaje, en imágenes", title: "Historias ilustradas ilimitadas" },
] as const;

// Copy del prototipo. El precio de cobro lo localiza RevenueCat en #31.
export const PAYWALL_DISPLAY_PRICE = "$4.99";
