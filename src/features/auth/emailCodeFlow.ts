/**
 * Lógica pura del login por correo (issue #104).
 *
 * Contexto de la API real: `@clerk/expo@4.5.0` reexporta los hooks de
 * `@clerk/react@6.14.4`, donde `useSignIn()` devuelve `SignInSignalValue`
 * (`{ signIn, errors, fetchStatus }`) y `signIn` es un `SignInFutureResource`.
 * O sea: la API que corre es la de *signals*, los métodos **devuelven**
 * `{ error }` en vez de lanzar, y el hook no expone `setActive` — la sesión se
 * activa con `finalize()`.
 *
 * El bug del reporte de beta ("sign up email didnt send email code") está acá:
 * cuando la API falla, el `error` devuelto es un `ClerkAPIResponseError`, cuyo
 * `.code` es **siempre** la constante `"api_response_error"`. El código por
 * campo vive en `error.errors[].code`. Comparar `error.code` contra
 * `"form_identifier_not_found"` nunca da true, así que el camino de sign-up era
 * código muerto y todo correo nuevo terminaba en el mensaje genérico.
 */

/** Segundos de espera antes de poder pedir otro código. */
export const RESEND_COOLDOWN_SECONDS = 30;

export const AUTH_ERROR_MESSAGES = {
  /** La API respondió mal y no sabemos más: es reintentable. */
  sendFailed: "No pudimos enviarte el código. Intentá de nuevo en unos segundos.",
  /** El correo existe pero no acepta código por correo (se registró con Google/Apple). */
  otherMethod: "Ese correo ya entra con Google o Apple. Volvé y entrá con ese botón.",
  /** No hubo red: no es culpa del correo. */
  offline: "Parece que no tenés conexión. Revisá tu internet e intentá de nuevo.",
  /** El código de 6 dígitos no sirve. */
  badCode: "Código incorrecto o vencido. Pedí uno nuevo.",
  /** Clerk pide un factor extra que esta pantalla no cubre. */
  moreSteps: "Tu cuenta necesita un paso adicional que todavía no soportamos acá.",
} as const;

export type AuthErrorKind = keyof typeof AUTH_ERROR_MESSAGES;

export function authErrorMessage(kind: AuthErrorKind): string {
  return AUTH_ERROR_MESSAGES[kind];
}

/** El identificador no existe todavía → hay que registrarlo. */
const IDENTIFIER_NOT_FOUND = "form_identifier_not_found";

/**
 * El correo existe pero el código por correo no es un camino válido para esa
 * cuenta. `factor_not_found` lo tira clerk-js cuando `selectFirstFactor` no
 * encuentra `email_code` entre los primeros factores (caso Google/Apple);
 * los otros dos los devuelve la API de Clerk.
 */
const OTHER_METHOD_CODES = new Set(["factor_not_found", "strategy_for_user_invalid", "form_identifier_exists"]);

/** Códigos con que clerk-js envuelve una falla de red / cliente sin conexión. */
const OFFLINE_CODES = new Set(["network_error", "clerk_offline"]);

/**
 * Todos los códigos que trae un error de Clerk. Un `ClerkAPIResponseError`
 * guarda los códigos útiles en `errors[].code` y deja `"api_response_error"`
 * arriba; un `ClerkRuntimeError` solo tiene el `.code` de arriba.
 */
export function clerkErrorCodes(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return [];
  }
  const codes: string[] = [];
  const nested = (error as { errors?: unknown }).errors;
  if (Array.isArray(nested)) {
    for (const item of nested) {
      const code = item && typeof item === "object" ? (item as { code?: unknown }).code : undefined;
      if (typeof code === "string") {
        codes.push(code);
      }
    }
  }
  const top = (error as { code?: unknown }).code;
  if (typeof top === "string") {
    codes.push(top);
  }
  return codes;
}

export function hasClerkErrorCode(error: unknown, code: string): boolean {
  return clerkErrorCodes(error).includes(code);
}

/** Traduce un error de Clerk a uno de los mensajes separados del issue #104. */
export function classifySendError(error: unknown): Extract<AuthErrorKind, "sendFailed" | "otherMethod" | "offline"> {
  const codes = clerkErrorCodes(error);
  if (codes.some((code) => OFFLINE_CODES.has(code))) {
    return "offline";
  }
  if (codes.some((code) => OTHER_METHOD_CODES.has(code))) {
    return "otherMethod";
  }
  return "sendFailed";
}

export function classifyVerifyError(error: unknown): Extract<AuthErrorKind, "badCode" | "offline"> {
  return clerkErrorCodes(error).some((code) => OFFLINE_CODES.has(code)) ? "offline" : "badCode";
}

/** Cada llamada de la API de signals devuelve esto: el error no se lanza. */
type ClerkAttempt = { error: unknown };

export type SendCodeDeps = {
  /** `signIn.emailCode.sendCode({ emailAddress })` — crea el sign-in y prepara el factor. */
  sendSignInCode: (emailAddress: string) => Promise<ClerkAttempt>;
  /** `signUp.create({ emailAddress })`. */
  createSignUp: (emailAddress: string) => Promise<ClerkAttempt>;
  /** `signUp.verifications.sendEmailCode()`. */
  sendSignUpCode: () => Promise<ClerkAttempt>;
};

export type SendCodeResult =
  | { ok: true; mode: "signIn" | "signUp" }
  | { ok: false; error: AuthErrorKind; cause: unknown };

/**
 * Clerk no tiene una sola API para "entrar o registrarse con este correo":
 * probamos sign-in y, solo si el identificador no existe, caemos a sign-up.
 * Las cuatro ramas: sign-in enviado, sign-up enviado, otro método, y falla
 * (red o API).
 */
export async function sendEmailCode(emailAddress: string, deps: SendCodeDeps): Promise<SendCodeResult> {
  const signInAttempt = await deps.sendSignInCode(emailAddress);
  if (!signInAttempt.error) {
    return { ok: true, mode: "signIn" };
  }

  // Solo "no existe" justifica registrar. Cualquier otro error es de un correo
  // que ya existe y se reporta como tal — pero se lee de `errors[].code`, no
  // del `.code` de arriba, que en un ClerkAPIResponseError es siempre constante.
  if (!hasClerkErrorCode(signInAttempt.error, IDENTIFIER_NOT_FOUND)) {
    return { ok: false, error: classifySendError(signInAttempt.error), cause: signInAttempt.error };
  }

  const created = await deps.createSignUp(emailAddress);
  if (created.error) {
    return { ok: false, error: classifySendError(created.error), cause: created.error };
  }

  const sent = await deps.sendSignUpCode();
  if (sent.error) {
    return { ok: false, error: classifySendError(sent.error), cause: sent.error };
  }

  return { ok: true, mode: "signUp" };
}

/**
 * Segundos que faltan para poder reenviar. Se calcula contra el reloj y no
 * descontando un contador, así que ni un re-render ni un intervalo perdido
 * corren el cooldown.
 */
export function resendCooldownRemaining(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) {
    return 0;
  }
  const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - (now - lastSentAt);
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
}

export function canResend(lastSentAt: number | null, now: number): boolean {
  return resendCooldownRemaining(lastSentAt, now) === 0;
}

/** Etiqueta del botón de reenviar, con el contador visible del cooldown. */
export function resendLabel(remainingSeconds: number): string {
  return remainingSeconds === 0 ? "Reenviar código" : `Reenviar en ${remainingSeconds} s`;
}
