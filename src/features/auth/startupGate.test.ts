import { describe, expect, it } from "vitest";

import { CLERK_LOAD_RETRY_MS, FONTS_TIMEOUT_MS, fontsReady } from "./startupGate";

describe("fontsReady", () => {
  it("espera mientras alguna familia todavía carga", () => {
    expect(fontsReady({ loaded: [true, false], errors: [null, null], timedOut: false })).toBe(false);
  });

  it("sigue cuando todas cargaron", () => {
    expect(fontsReady({ loaded: [true, true], errors: [null, null], timedOut: false })).toBe(true);
  });

  it("sigue si una familia falló: se usa la fuente del sistema", () => {
    expect(fontsReady({ loaded: [true, false], errors: [null, new Error("sin fuente")], timedOut: false })).toBe(true);
  });

  it("sigue al vencer el tope aunque nada haya contestado (rechazo 2.1(a) de la 1.0.2)", () => {
    expect(fontsReady({ loaded: [false, false], errors: [null, null], timedOut: true })).toBe(true);
  });
});

describe("topes del arranque", () => {
  it("las fuentes se rinden antes de que se ofrezca reintentar Clerk", () => {
    expect(FONTS_TIMEOUT_MS).toBeLessThan(CLERK_LOAD_RETRY_MS);
  });
});
