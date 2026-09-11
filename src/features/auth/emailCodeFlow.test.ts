import { describe, expect, it, vi } from "vitest";

import {
  AUTH_ERROR_MESSAGES,
  RESEND_COOLDOWN_SECONDS,
  canResend,
  classifySendError,
  classifyVerifyError,
  clerkErrorCodes,
  hasClerkErrorCode,
  resendCooldownRemaining,
  resendEmailCode,
  resendLabel,
  sendEmailCode,
  type SendCodeDeps,
} from "./emailCodeFlow";

/**
 * Forma real de un `ClerkAPIResponseError` de `@clerk/shared`: el `.code` de
 * arriba es la constante `"api_response_error"` y los códigos útiles viven en
 * `errors[].code`. Ver node_modules/@clerk/expo/node_modules/@clerk/shared/dist/errors/clerkApiResponseError.js.
 */
function apiResponseError(...codes: string[]) {
  return {
    clerkError: true,
    code: "api_response_error",
    status: 422,
    errors: codes.map((code) => ({ code, message: code })),
  };
}

/** Forma real de un `ClerkRuntimeError`: solo `.code` arriba, sin `errors`. */
function runtimeError(code: string) {
  return { clerkError: true, code, message: code };
}

const ok = { error: null };

function depsFor(overrides: Partial<SendCodeDeps> = {}) {
  const deps = {
    sendSignInCode: vi.fn(async () => ok),
    createSignUp: vi.fn(async () => ok),
    sendSignUpCode: vi.fn(async () => ok),
    ...overrides,
  };
  return deps as SendCodeDeps & typeof deps;
}

describe("clerkErrorCodes", () => {
  it("saca los códigos de errors[] y no solo el api_response_error de arriba", () => {
    expect(clerkErrorCodes(apiResponseError("form_identifier_not_found"))).toEqual([
      "form_identifier_not_found",
      "api_response_error",
    ]);
  });

  it("lee el .code de un ClerkRuntimeError, que no tiene errors[]", () => {
    expect(clerkErrorCodes(runtimeError("network_error"))).toEqual(["network_error"]);
  });

  it("no explota con un error que no es de Clerk", () => {
    expect(clerkErrorCodes(new TypeError("boom"))).toEqual([]);
    expect(clerkErrorCodes(null)).toEqual([]);
    expect(clerkErrorCodes("boom")).toEqual([]);
  });

  it("hasClerkErrorCode encuentra el código anidado (el bug de email.tsx:60)", () => {
    const error = apiResponseError("form_identifier_not_found");
    expect(hasClerkErrorCode(error, "form_identifier_not_found")).toBe(true);
    // Lo que hacía el código viejo: leer error.code directo.
    expect((error as { code: string }).code).not.toBe("form_identifier_not_found");
  });
});

describe("sendEmailCode — las cuatro ramas", () => {
  it("rama 1: correo existente con email_code → sign-in, sin tocar sign-up", async () => {
    const deps = depsFor();

    const result = await sendEmailCode("luis@ejemplo.com", deps);

    expect(result).toEqual({ ok: true, mode: "signIn" });
    expect(deps.sendSignInCode).toHaveBeenCalledWith("luis@ejemplo.com");
    expect(deps.createSignUp).not.toHaveBeenCalled();
  });

  it("rama 2: correo nuevo (form_identifier_not_found) → cae a sign-up y envía", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: apiResponseError("form_identifier_not_found") })),
    });

    const result = await sendEmailCode("nuevo@ejemplo.com", deps);

    expect(result).toEqual({ ok: true, mode: "signUp" });
    expect(deps.createSignUp).toHaveBeenCalledWith("nuevo@ejemplo.com");
    expect(deps.sendSignUpCode).toHaveBeenCalledTimes(1);
  });

  it("rama 3: correo registrado con Google (factor_not_found) → otro método, no registra", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: runtimeError("factor_not_found") })),
    });

    const result = await sendEmailCode("google@ejemplo.com", deps);

    expect(result).toMatchObject({ ok: false, error: "otherMethod" });
    expect(deps.createSignUp).not.toHaveBeenCalled();
  });

  it("rama 4: sin conexión (network_error) → offline, no lo confunde con 'no pudimos enviarlo'", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: runtimeError("network_error") })),
    });

    const result = await sendEmailCode("luis@ejemplo.com", deps);

    expect(result).toMatchObject({ ok: false, error: "offline" });
    expect(deps.createSignUp).not.toHaveBeenCalled();
  });
});

describe("sendEmailCode — ramificación y fallas del sign-up", () => {
  it("un error cualquiera del sign-in NO dispara el registro", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: apiResponseError("form_param_format_invalid") })),
    });

    const result = await sendEmailCode("mal@@ejemplo", deps);

    expect(result).toMatchObject({ ok: false, error: "sendFailed" });
    expect(deps.createSignUp).not.toHaveBeenCalled();
  });

  it("signUp.create con form_identifier_exists → el correo usa otro método", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: apiResponseError("form_identifier_not_found") })),
      createSignUp: vi.fn(async () => ({ error: apiResponseError("form_identifier_exists") })),
    });

    const result = await sendEmailCode("google@ejemplo.com", deps);

    expect(result).toMatchObject({ ok: false, error: "otherMethod" });
    expect(deps.sendSignUpCode).not.toHaveBeenCalled();
  });

  it("si el envío del código de sign-up falla, no decimos que ya se envió", async () => {
    const deps = depsFor({
      sendSignInCode: vi.fn(async () => ({ error: apiResponseError("form_identifier_not_found") })),
      sendSignUpCode: vi.fn(async () => ({ error: apiResponseError("too_many_requests") })),
    });

    const result = await sendEmailCode("nuevo@ejemplo.com", deps);

    expect(result).toMatchObject({ ok: false, error: "sendFailed" });
  });

  it("propaga el error original como cause para poder loguearlo", async () => {
    const cause = runtimeError("network_error");
    const deps = depsFor({ sendSignInCode: vi.fn(async () => ({ error: cause })) });

    const result = await sendEmailCode("luis@ejemplo.com", deps);

    expect(result).toEqual({ ok: false, error: "offline", cause });
  });
});

describe("mensajes de error", () => {
  it("los tres mensajes de envío son distintos entre sí", () => {
    const { sendFailed, otherMethod, offline } = AUTH_ERROR_MESSAGES;
    expect(new Set([sendFailed, otherMethod, offline]).size).toBe(3);
  });

  it("clasifica por código, no por el texto del mensaje", () => {
    expect(classifySendError({ code: "api_response_error", message: "Network error", errors: [] })).toBe("sendFailed");
    expect(classifySendError(runtimeError("clerk_offline"))).toBe("offline");
    expect(classifySendError(apiResponseError("strategy_for_user_invalid"))).toBe("otherMethod");
  });

  it("un código malo no se reporta como falta de conexión", () => {
    expect(classifyVerifyError(apiResponseError("form_code_incorrect"))).toBe("badCode");
    expect(classifyVerifyError(runtimeError("network_error"))).toBe("offline");
  });
});

describe("cooldown de reenvío", () => {
  const sentAt = 1_000_000;

  it("arranca en 30 s y llega a 0 justo al cumplirse el cooldown", () => {
    expect(resendCooldownRemaining(sentAt, sentAt)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(resendCooldownRemaining(sentAt, sentAt + 1)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(resendCooldownRemaining(sentAt, sentAt + 29_500)).toBe(1);
    expect(resendCooldownRemaining(sentAt, sentAt + 30_000)).toBe(0);
    expect(resendCooldownRemaining(sentAt, sentAt + 90_000)).toBe(0);
  });

  it("sin envío previo no hay cooldown", () => {
    expect(resendCooldownRemaining(null, sentAt)).toBe(0);
    expect(canResend(null, sentAt)).toBe(true);
  });

  it("bloquea el reenvío hasta que el contador llega a 0", () => {
    expect(canResend(sentAt, sentAt)).toBe(false);
    expect(canResend(sentAt, sentAt + 29_999)).toBe(false);
    expect(canResend(sentAt, sentAt + 30_000)).toBe(true);
  });

  it("la etiqueta muestra el contador mientras espera", () => {
    expect(resendLabel(0)).toBe("Reenviar código");
    expect(resendLabel(30)).toBe("Reenviar en 30 s");
    expect(resendLabel(1)).toBe("Reenviar en 1 s");
  });
});

// ── Reenviar el código (#124) ───────────────────────────────

/** Un `ClerkAPIResponseError` con el código útil en `errors[].code`. */
function apiError(code: string) {
  return { code: "api_response_error", errors: [{ code }] };
}

describe("resendEmailCode", () => {
  it("reenvía el sign-in sin identificador mientras el intento siga vivo", async () => {
    const resendSignInCode = vi.fn(async () => ({ error: null }));
    const resendSignUpCode = vi.fn(async () => ({ error: null }));

    const result = await resendEmailCode("signIn", "ana@example.hn", {
      hasSignInAttempt: () => true,
      resendSignInCode,
      resendSignUpCode,
    });

    expect(result).toEqual({ ok: true, mode: "signIn" });
    expect(resendSignInCode).toHaveBeenCalledWith(undefined);
    expect(resendSignUpCode).not.toHaveBeenCalled();
  });

  it("si el intento de sign-in se perdió, reenvía con el correo en vez de quedarse sin salida", async () => {
    const resendSignInCode = vi.fn(async () => ({ error: null }));

    const result = await resendEmailCode("signIn", "  ana@example.hn  ".trim(), {
      hasSignInAttempt: () => false,
      resendSignInCode,
      resendSignUpCode: vi.fn(),
    });

    expect(result).toEqual({ ok: true, mode: "signIn" });
    expect(resendSignInCode).toHaveBeenCalledWith("ana@example.hn");
  });

  it("el sign-up reenvía por su propio camino y nunca mira el intento de sign-in", async () => {
    const resendSignUpCode = vi.fn(async () => ({ error: null }));
    const hasSignInAttempt = vi.fn(() => false);

    const result = await resendEmailCode("signUp", "ana@example.hn", {
      hasSignInAttempt,
      resendSignInCode: vi.fn(),
      resendSignUpCode,
    });

    expect(result).toEqual({ ok: true, mode: "signUp" });
    expect(resendSignUpCode).toHaveBeenCalledOnce();
    expect(hasSignInAttempt).not.toHaveBeenCalled();
  });

  it("una EXCEPCIÓN de Clerk se convierte en un error visible, no en un unhandled rejection (#124)", async () => {
    // `signIn.emailCode.sendCode()` lanza (no devuelve `{ error }`) cuando el
    // guard de precondición no se cumple. El botón de #104 no lo capturaba:
    // se quedaba mudo y el usuario concluía que el reenvío no funciona.
    const boom = new Error("signIn.emailCode.sendCode() cannot be called without an emailAddress …");
    const result = await resendEmailCode("signIn", "ana@example.hn", {
      hasSignInAttempt: () => true,
      resendSignInCode: vi.fn(async () => {
        throw boom;
      }),
      resendSignUpCode: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "sendFailed", cause: boom });
  });

  it("una excepción de red se reporta como falta de conexión", async () => {
    const offline = { code: "network_error" };
    const result = await resendEmailCode("signUp", "ana@example.hn", {
      hasSignInAttempt: () => true,
      resendSignInCode: vi.fn(),
      resendSignUpCode: vi.fn(async () => {
        throw offline;
      }),
    });

    expect(result).toEqual({ ok: false, error: "offline", cause: offline });
  });

  it("un error devuelto por la API se clasifica igual que en el primer envío", async () => {
    const error = apiError("strategy_for_user_invalid");
    const result = await resendEmailCode("signIn", "ana@example.hn", {
      hasSignInAttempt: () => true,
      resendSignInCode: vi.fn(async () => ({ error })),
      resendSignUpCode: vi.fn(),
    });

    expect(result).toEqual({ ok: false, error: "otherMethod", cause: error });
  });
});
