/**
 * "Proteger lo personal" (#171): lógica pura del candado de Mi espacio, Sentir
 * y Exportar. Vive aparte de React Native para poder testearla.
 *
 * No hay PIN propio: se usa Face ID, la huella o el bloqueo del teléfono
 * (`expo-local-authentication`). La preferencia es del teléfono, no de la
 * cuenta: en un teléfono compartido la decide quien lo usa.
 */

/** Después de este tiempo en segundo plano se vuelve a pedir. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Sesión de desbloqueo, compartida entre las pantallas protegidas: si ya
 * desbloqueaste Mi espacio, Sentir no vuelve a pedir hasta que la app pase
 * 5 minutos en segundo plano.
 */
export type LockSession = { unlocked: boolean; backgroundAt: number | null };

export const LOCKED_SESSION: LockSession = { unlocked: false, backgroundAt: null };

/** La app se fue a segundo plano: se anota cuándo (solo la primera vez). */
export function sessionOnBackground(session: LockSession, now: number): LockSession {
  return session.backgroundAt === null ? { ...session, backgroundAt: now } : session;
}

/** La app volvió: si pasaron 5 minutos o más, se cierra el candado. */
export function sessionOnForeground(session: LockSession, now: number): LockSession {
  if (session.backgroundAt === null) return session;
  const expired = now - session.backgroundAt >= RELOCK_AFTER_MS;
  return { unlocked: expired ? false : session.unlocked, backgroundAt: null };
}

/** ¿Hay que tapar el contenido y pedir autenticación? */
export function needsUnlock(enabled: boolean, available: boolean, session: LockSession): boolean {
  // Si el teléfono ya no tiene bloqueo, no hay con qué pedir: quitar el bloqueo
  // del teléfono ya exigió el PIN, así que no es un hueco.
  return enabled && available && !session.unlocked;
}

/**
 * Widget "Tu lectura de hoy" (#184): con "Proteger lo personal" encendido no
 * muestra plan, lecturas ni racha. Sigue a la preferencia, no a la sesión:
 * desbloquear Mi espacio no destapa el widget de la pantalla de inicio.
 *
 * Devuelve el valor a escribir, o null si no hay que tocar nada (todavía no se
 * leyó la preferencia, o el widget ya está como corresponde). Así se repara
 * también un widget que quedó desfasado, por ejemplo si el bloqueo se encendió
 * en una versión anterior de la app.
 */
export function widgetLockUpdate(enabled: boolean | null, widgetLocked: boolean): boolean | null {
  if (enabled === null || enabled === widgetLocked) return null;
  return enabled;
}

/**
 * "Mis conversaciones" (Ajustes) lista también las de Sentir, con su último
 * mensaje. Esa pantalla no lleva candado (Preguntar y Voces quedan libres),
 * así que mientras lo personal no esté desbloqueado, las de Sentir no salen.
 */
export function hideLockedFeelings<T extends { module: string }>(
  items: T[],
  status: "checking" | "locked" | "open",
): T[] {
  return status === "open" ? items : items.filter((item) => item.module !== "feelings");
}

/** Lo que reporta el teléfono, con la forma de `expo-local-authentication`. */
export type DeviceSecurity = {
  hasHardware: boolean;
  isEnrolled: boolean;
  /** `SecurityLevel`: 0 ninguno, 1 PIN/patrón, 2-3 biometría. */
  level: number;
};

export type LockAvailability = { available: true } | { available: false; reason: string };

export const LOCK_UNAVAILABLE_COPY =
  "Tu teléfono no tiene Face ID, huella ni bloqueo de pantalla. Activá uno en los ajustes del teléfono y volvé acá.";

export function lockAvailability(device: DeviceSecurity | null): LockAvailability {
  // `level` > 0 alcanza: con solo un PIN del teléfono también se protege.
  if (device && (device.level > 0 || (device.hasHardware && device.isEnrolled))) {
    return { available: true };
  }
  return { available: false, reason: LOCK_UNAVAILABLE_COPY };
}

/**
 * Qué hacer con el resultado de `authenticateAsync`:
 * - `unlock`: pasó.
 * - `back`: la persona canceló; se vuelve a la pantalla anterior sin mostrar nada.
 * - `stay`: algo del sistema la interrumpió (otra app, bloqueo por intentos);
 *   se queda la pantalla tapada con "Desbloquear" para reintentar.
 * - `pass`: el teléfono ya no tiene con qué autenticar (ver `needsUnlock`).
 */
export type AuthOutcome = "unlock" | "back" | "stay" | "pass";

export function authOutcome(result: { success: true } | { success: false; error: string }): AuthOutcome {
  if (result.success) return "unlock";
  switch (result.error) {
    case "user_cancel":
    case "user_fallback":
      return "back";
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
      return "pass";
    default:
      return "stay";
  }
}

/** Texto bajo "Proteger lo personal" en Ajustes. */
export function lockSettingHint(availability: LockAvailability): string {
  return availability.available
    ? "Pide Face ID, huella o el PIN del teléfono para abrir Mi espacio y Sentir."
    : availability.reason;
}

export const LOCK_PROMPT = "Desbloqueá para ver lo personal";
