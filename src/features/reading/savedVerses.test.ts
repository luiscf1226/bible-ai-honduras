import { describe, expect, it } from "vitest";

import { removeSavedCopy, savedWhenLabel, seeAllLabel } from "./savedVerses";

// 30 sep 2026, 15:00 en Tegucigalpa (UTC-6).
const NOW = Date.UTC(2026, 8, 30, 21, 0, 0);
const HOUR = 60 * 60 * 1000;

describe("guardados (#166)", () => {
  it("muestra cuándo se guardó en hora de Honduras", () => {
    expect(savedWhenLabel(NOW - HOUR, NOW)).toBe("guardado hoy");
    expect(savedWhenLabel(NOW - 20 * HOUR, NOW)).toBe("guardado ayer");
    expect(savedWhenLabel(Date.UTC(2026, 7, 12, 18), NOW)).toMatch(/^guardado el 12 ago/);
  });

  it("con 20 guardados ofrece Ver todos (20); con 3 o menos no", () => {
    expect(seeAllLabel(20)).toBe("Ver todos (20)");
    expect(seeAllLabel(3)).toBeNull();
    expect(seeAllLabel(0)).toBeNull();
  });

  it("avisa que la nota se borra al quitar el guardado (#167)", () => {
    expect(removeSavedCopy(true).body).toContain("nota");
    expect(removeSavedCopy(false).body).not.toContain("nota");
  });
});
