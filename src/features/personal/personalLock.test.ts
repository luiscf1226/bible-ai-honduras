import { describe, expect, it } from "vitest";

import {
  LOCKED_SESSION,
  LOCK_UNAVAILABLE_COPY,
  RELOCK_AFTER_MS,
  authOutcome,
  hideLockedFeelings,
  lockAvailability,
  lockSettingHint,
  needsUnlock,
  sessionOnBackground,
  sessionOnForeground,
  widgetLockUpdate,
} from "./personalLock";

const unlocked = { unlocked: true, backgroundAt: null };

describe("needsUnlock", () => {
  it("apagado por defecto: no pide nada", () => {
    expect(needsUnlock(false, true, LOCKED_SESSION)).toBe(false);
  });

  it("encendido y sin desbloquear: pide", () => {
    expect(needsUnlock(true, true, LOCKED_SESSION)).toBe(true);
  });

  it("ya desbloqueado en esta sesión: no vuelve a pedir", () => {
    expect(needsUnlock(true, true, unlocked)).toBe(false);
  });

  it("si el teléfono ya no tiene bloqueo no hay con qué pedir", () => {
    expect(needsUnlock(true, false, LOCKED_SESSION)).toBe(false);
  });
});

describe("sesión y segundo plano", () => {
  it("menos de 5 minutos en segundo plano: sigue desbloqueado", () => {
    const away = sessionOnBackground(unlocked, 1_000);
    const back = sessionOnForeground(away, 1_000 + RELOCK_AFTER_MS - 1);
    expect(back).toEqual({ unlocked: true, backgroundAt: null });
  });

  it("5 minutos o más: se vuelve a pedir", () => {
    const away = sessionOnBackground(unlocked, 1_000);
    const back = sessionOnForeground(away, 1_000 + RELOCK_AFTER_MS);
    expect(back).toEqual({ unlocked: false, backgroundAt: null });
    expect(needsUnlock(true, true, back)).toBe(true);
  });

  it("cuenta desde la primera vez que se fue, no desde la última", () => {
    const first = sessionOnBackground(unlocked, 1_000);
    const second = sessionOnBackground(first, 1_000 + RELOCK_AFTER_MS - 10);
    expect(second.backgroundAt).toBe(1_000);
  });

  it("volver sin haberse ido no cambia nada", () => {
    expect(sessionOnForeground(unlocked, 99)).toBe(unlocked);
  });
});

describe("lockAvailability", () => {
  it("con solo el PIN del teléfono alcanza", () => {
    expect(lockAvailability({ hasHardware: false, isEnrolled: false, level: 1 })).toEqual({ available: true });
  });

  it("con biometría registrada", () => {
    expect(lockAvailability({ hasHardware: true, isEnrolled: true, level: 3 })).toEqual({ available: true });
  });

  it("sin biometría ni bloqueo: deshabilitado y explica por qué", () => {
    const result = lockAvailability({ hasHardware: true, isEnrolled: false, level: 0 });
    expect(result).toEqual({ available: false, reason: LOCK_UNAVAILABLE_COPY });
    expect(lockSettingHint(result)).toBe(LOCK_UNAVAILABLE_COPY);
  });

  it("si no se pudo leer el teléfono, deshabilitado", () => {
    expect(lockAvailability(null).available).toBe(false);
  });

  it("el texto disponible menciona las dos pantallas", () => {
    const hint = lockSettingHint({ available: true });
    expect(hint).toContain("Mi espacio");
    expect(hint).toContain("Sentir");
  });
});

describe("authOutcome", () => {
  it("éxito desbloquea", () => {
    expect(authOutcome({ success: true })).toBe("unlock");
  });

  it("cancelar vuelve atrás", () => {
    expect(authOutcome({ success: false, error: "user_cancel" })).toBe("back");
  });

  it("una interrupción del sistema deja la pantalla tapada para reintentar", () => {
    expect(authOutcome({ success: false, error: "system_cancel" })).toBe("stay");
    expect(authOutcome({ success: false, error: "app_cancel" })).toBe("stay");
    expect(authOutcome({ success: false, error: "lockout" })).toBe("stay");
    expect(authOutcome({ success: false, error: "authentication_failed" })).toBe("stay");
  });

  it("sin bloqueo en el teléfono deja pasar", () => {
    expect(authOutcome({ success: false, error: "not_enrolled" })).toBe("pass");
    expect(authOutcome({ success: false, error: "passcode_not_set" })).toBe("pass");
  });
});

describe("hideLockedFeelings (#171 — Mis conversaciones)", () => {
  const items = [
    { id: "1", module: "qa" },
    { id: "2", module: "feelings" },
    { id: "3", module: "voices" },
  ];

  it("con lo personal desbloqueado (o sin candado) se ve todo", () => {
    expect(hideLockedFeelings(items, "open")).toEqual(items);
  });

  it("bloqueado o todavía revisando, las de Sentir no salen", () => {
    expect(hideLockedFeelings(items, "locked").map((item) => item.id)).toEqual(["1", "3"]);
    expect(hideLockedFeelings(items, "checking").map((item) => item.id)).toEqual(["1", "3"]);
  });
});

describe("widgetLockUpdate (#184)", () => {
  it("encender el candado vacía el widget", () => {
    expect(widgetLockUpdate(true, false)).toBe(true);
  });

  it("apagarlo lo vuelve a llenar", () => {
    expect(widgetLockUpdate(false, true)).toBe(false);
  });

  it("si ya coincide no escribe nada", () => {
    expect(widgetLockUpdate(true, true)).toBeNull();
    expect(widgetLockUpdate(false, false)).toBeNull();
  });

  it("mientras no se leyó la preferencia no toca el widget", () => {
    expect(widgetLockUpdate(null, true)).toBeNull();
    expect(widgetLockUpdate(null, false)).toBeNull();
  });
});
