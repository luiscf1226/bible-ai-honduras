import { REFERRAL_CLAIM_WINDOW_DAYS, type ClaimStatus } from "../../convex/referralCode";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "¿Te invitó alguien?" en Ajustes: solo mientras todavía se puede anotar
 * (cuenta de menos de 30 días y sin invitación). Después la fila no aparece:
 * un campo que siempre responde "ya es tarde" estorba.
 */
export function canEnterReferral(
  user: { _creationTime: number; referredBy?: string } | null | undefined,
  now: number = Date.now(),
): boolean {
  return Boolean(user) && !user?.referredBy && now - (user?._creationTime ?? now) <= REFERRAL_CLAIM_WINDOW_DAYS * DAY_MS;
}

/** Qué decirle a la persona después de escribir el código a mano. */
export function claimMessage(status: ClaimStatus): string {
  switch (status) {
    case "ok":
      return "Listo. Gracias por contarnos quién te invitó.";
    case "already":
      return "Ya tenías anotada una invitación.";
    case "self":
      return "Ese es tu propio código: compartilo para invitar a alguien.";
    case "too_late":
      return "Ya pasaron más de 30 días desde que creaste tu cuenta.";
    case "not_found":
      return "No encontramos ese código. Revisá que esté bien escrito.";
    case "invalid":
      return "El código tiene la forma BAH- y siete letras o números.";
  }
}
