import { QUOTA_LIMITS } from "../../convex/quotas";

// El número de devocionales sale de la cuota real (el prototipo decía "dos").
export const PAYWALL_FEATURES = [
  { subtitle: "Q&A guiado y pregunta libre, todo el día", title: "Preguntas sin contar" },
  { subtitle: "Sin cortes a media conversación", title: "Conversaciones largas con los personajes" },
  { subtitle: `Cada vez que lo necesites, no ${QUOTA_LIMITS.feelings} al día`, title: "Devocionales para lo que estés viviendo" },
  { subtitle: "Cualquier pasaje, en imágenes", title: "Historias ilustradas ilimitadas" },
] as const;

// Copy del prototipo. El precio de cobro lo localiza RevenueCat en #31.
export const PAYWALL_DISPLAY_PRICE = "$4.99";
