import { QUOTA_LIMITS } from "../../convex/quotas";
import type { MonthlyOfferResult, PurchaseResult } from "./revenuecat";

// El número de devocionales sale de la cuota real (el prototipo decía "dos").
export const PAYWALL_FEATURES = [
  { subtitle: "Q&A guiado y pregunta libre, todo el día", title: "Preguntas sin contar" },
  { subtitle: "Sin cortes a media conversación", title: "Conversaciones largas con los personajes" },
  { subtitle: `Cada vez que lo necesites, no ${QUOTA_LIMITS.feelings} al día`, title: "Devocionales para lo que estés viviendo" },
  { subtitle: "Cualquier pasaje, en imágenes", title: "Historias ilustradas ilimitadas" },
] as const;

// Nombre de la suscripción cuando la tienda no manda el suyo.
export const PAYWALL_PRODUCT_NAME = "Bible AI Honduras Pro";

/**
 * Precio, duración y renovación (#144, App Store 3.1.2). El precio llega de la
 * tienda ya localizado (`product.priceString`): acá nunca se escribe un monto.
 */
export function paywallPriceHint(): string {
  return "al mes · se renueva sola";
}

export function paywallRenewalTerms(params: { priceString: string; productName?: string | null }): string {
  const name = params.productName?.trim() || PAYWALL_PRODUCT_NAME;
  return (
    `${name}: suscripción mensual de ${params.priceString}. Se renueva automáticamente cada mes ` +
    "y se cobra a tu cuenta de App Store o Google Play. Cancelala desde la tienda al menos 24 horas " +
    "antes de que termine el mes para que no se renueve."
  );
}

/** Estado de la oferta mientras se carga o si no llegó. `null` = hay precio, no hay aviso. */
export function offerNotice(result: MonthlyOfferResult | undefined): string | null {
  if (result === undefined) return "Buscando el precio en la tienda…";
  if (result.ok) return null;
  switch (result.reason) {
    case "not_configured":
      return "Pro todavía no está a la venta. Escribinos y te lo activamos.";
    case "dev_build_required":
      return "La compra se completa en la app instalada desde la tienda. Seguí en la versión gratis por ahora.";
    case "network_error":
      return "No pudimos conectar con la tienda. Revisá tu conexión y probá de nuevo.";
    case "offering_unavailable":
      return "Pro no está disponible en este momento. Probá de nuevo más tarde.";
  }
}

/** La oferta falló de una forma que vale la pena reintentar. */
export function offerRetryable(result: MonthlyOfferResult | undefined): boolean {
  return result !== undefined && !result.ok && (result.reason === "network_error" || result.reason === "offering_unavailable");
}

/**
 * Aviso después de tocar comprar o restaurar. Ningún fallo desbloquea Pro: Pro
 * solo llega por `entitlements.mine` (el webhook). Cancelar no es un error.
 */
export function purchaseNotice(result: PurchaseResult, action: "purchase" | "restore"): string | null {
  if (result.ok || result.reason === "user_cancelled") return null;
  switch (result.reason) {
    case "dev_build_required":
      return action === "purchase"
        ? "La compra se completa en la app instalada desde la tienda. Seguí en la versión gratis por ahora."
        : "La restauración se completa en la app instalada desde la tienda. Seguí en la versión gratis por ahora.";
    case "network_error":
      return "No pudimos conectar con la tienda. Revisá tu conexión y probá de nuevo.";
    case "offering_unavailable":
      return "Pro no está disponible en este momento. Probá de nuevo más tarde.";
    case "not_configured":
      return "Pro todavía no está a la venta. Escribinos y te lo activamos.";
    case "purchase_failed":
      return action === "purchase"
        ? "No pudimos completar la compra. Seguí en la versión gratis por ahora."
        : "No encontramos una compra para restaurar con esta cuenta de la tienda.";
  }
}
