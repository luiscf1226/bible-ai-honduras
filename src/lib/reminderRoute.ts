/**
 * A dónde lleva tocar el aviso diario (#194). Puro, sin expo-notifications,
 * para poder testearlo.
 *
 * El aviso abre el versículo del día en su pantalla propia (`/hoy`). Los
 * avisos que ya estaban programados antes de este cambio traen
 * `pathname: "/home"`: se reconocen por `kind` y también van a `/hoy`.
 */
export const DAILY_REMINDER_KIND = "daily-devotional";
export const DAILY_REMINDER_PATHNAME = "/hoy";

export function reminderRouteFor(data: unknown): typeof DAILY_REMINDER_PATHNAME | null {
  if (typeof data !== "object" || data === null) return null;
  return (data as { kind?: unknown }).kind === DAILY_REMINDER_KIND ? DAILY_REMINDER_PATHNAME : null;
}
