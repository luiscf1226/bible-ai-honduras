import { describe, expect, it } from "vitest";

import { tokens } from "./tokens";

describe("tokens palettes", () => {
  it("noche y día comparten las mismas claves de color", () => {
    expect(Object.keys(tokens.night.color).sort()).toEqual(Object.keys(tokens.color).sort());
  });

  it("la noche suave no usa negro puro", () => {
    expect(Object.values(tokens.night.color)).not.toContain("#000000");
    expect(tokens.night.color.bg).toBe("#211F1D");
    expect(tokens.night.color.surface).toBe("#292522");
    expect(tokens.night.color.ink).toBe("#EDE6DA");
    expect(tokens.night.color.accent).toBe("#C99B5E");
  });

  it("el paywall mide la paleta del prototipo, no negro puro", () => {
    expect(tokens.paywall.color.bgStart).toBe("#3B352E");
    expect(tokens.paywall.color.bgMid).toBe("#2E2A25");
    expect(tokens.paywall.color.bgEnd).toBe("#252220");
    expect(Object.values(tokens.paywall.color)).not.toContain("#000000");
  });
});
