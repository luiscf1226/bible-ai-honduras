/**
 * Donaciones: un link a una página de donación afuera de la app. La app nunca
 * cobra: abre el navegador.
 *
 * Por las reglas de las tiendas va apagado por plataforma
 * (`EXPO_PUBLIC_DONATION_PLATFORMS`):
 * - App Store (3.1.1, 3.2.1(vi), 3.2.2(iv)): un link a donar afuera solo se
 *   acepta si el que recibe es una organización sin fines de lucro aprobada
 *   por Apple. Una "propina" al desarrollador tiene que ir por compra dentro
 *   de la app.
 * - Google Play (política de pagos): una donación sin Google Play Billing solo
 *   se acepta para una organización exenta de impuestos.
 * - El APK que se baja del sitio no pasa por ninguna tienda.
 *
 * Por eso cada plataforma se enciende a mano, cuando la cuenta que recibe
 * cumple la regla de esa tienda.
 */
export type DonationPlatform = "ios" | "android" | "web";

export function donationUrl(
  platform: string,
  env: { url?: string; platforms?: string } = {
    url: process.env.EXPO_PUBLIC_DONATION_URL,
    platforms: process.env.EXPO_PUBLIC_DONATION_PLATFORMS,
  },
): string | null {
  const url = env.url?.trim();
  if (!url || !/^https:\/\/[^\s]+$/.test(url)) return null;
  const allowed = (env.platforms ?? "").split(",").map((entry) => entry.trim().toLowerCase());
  return allowed.includes(platform) ? url : null;
}
