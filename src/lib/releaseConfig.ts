/**
 * Cómo se vende Pro en este build. Lo decide `EXPO_PUBLIC_PAYMENTS_MODE` al
 * compilar (o al publicar una actualización OTA):
 *
 * - `off` (sin valor): edición gratuita. Los límites del servidor siguen, pero
 *   no hay paywall ni precio. Una key de RevenueCat olvidada en EAS no activa
 *   nada.
 * - `test`: paywall con compra simulada (`entitlements.grantTestPro`). Solo
 *   funciona contra un Convex con `PAYMENTS_TEST_MODE=1`. Sin tienda ni llaves.
 * - `revenuecat`: compra real por RevenueCat con
 *   `EXPO_PUBLIC_REVENUECAT_API_KEY` (la del Test Store de RevenueCat sirve
 *   para probar en un development build).
 */
export type PaymentsMode = "off" | "test" | "revenuecat";

export function paymentsMode(): PaymentsMode {
  const mode = process.env.EXPO_PUBLIC_PAYMENTS_MODE;
  return mode === "test" || mode === "revenuecat" ? mode : "off";
}

export const PAYMENTS_ENABLED = paymentsMode() !== "off";

/**
 * Precio de Pro que se configura en App Store Connect y Google Play. La app no
 * lo muestra en una compra real: ahí el precio llega de la tienda ya
 * localizado (#144). Solo lo usa la compra simulada del modo de prueba.
 */
export const PRO_MONTHLY_PRICE_USD = 2.99;

/** Hasta tener metadata de builds públicos separada de TestFlight en el backend. */
export const IOS_UPDATE_CHECKS_ENABLED = false;
