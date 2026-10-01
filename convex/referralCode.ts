/**
 * Formato y lectura del código de invitación (PRD §9b). Sin funciones de
 * Convex: lo importan el backend (`referrals.ts`), la app y los tests.
 *
 * El código es el `referralCode` de quien comparte (`users.makeReferralCode`):
 * "BAH-" + 7 caracteres en base 36, en mayúsculas.
 */

const CODE_PATTERN = /^BAH-[0-9A-Z]{7}$/;

/** Lo que la persona escribió o lo que vino en un link → el código, o null. */
export function parseReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  // "bah1234567" o "BAH 1234567": se acepta sin el guion, se guarda con él.
  const withDash = /^BAH[0-9A-Z]{7}$/.test(code) ? `BAH-${code.slice(3)}` : code;
  return CODE_PATTERN.test(withDash) ? withDash : null;
}

/**
 * El `ref` de una URL o de un query string ("ref=BAH-…&utm_source=…").
 * Sirve para el link de la app (`bibleai://home?ref=…`) y para el install
 * referrer de Google Play, que llega como query string sin `?`.
 */
export function referralFromQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
  for (const part of query.split(/[&#]/)) {
    const [key, value = ""] = part.split("=");
    if (key === "ref") {
      try {
        return parseReferralCode(decodeURIComponent(value.replace(/\+/g, " ")));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Cuánto después de crear la cuenta todavía se puede decir quién te invitó. */
export const REFERRAL_CLAIM_WINDOW_DAYS = 30;

export type ReferralVia = "link" | "play" | "manual";

export type ClaimStatus = "ok" | "already" | "invalid" | "not_found" | "self" | "too_late";
