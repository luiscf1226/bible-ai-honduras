import { reminderRouteFor } from "./reminderRoute";

/**
 * A dónde lleva tocar un aviso. Puro, sin expo-notifications, para poder
 * testearlo.
 *
 * Los avisos push (1.0.4) traen la ruta en `data.url`, puesta por el servidor
 * (`convex/pushCore.ts`): un aviso nuevo abre lo que el servidor diga sin
 * sacar otra versión. Solo rutas de la app ("/algo"), nunca un link de afuera.
 */
export function notificationRouteFor(data: unknown): string | null {
  const reminder = reminderRouteFor(data);
  if (reminder) return reminder;
  if (typeof data !== "object" || data === null) return null;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.length > 200) return null;
  return url;
}
