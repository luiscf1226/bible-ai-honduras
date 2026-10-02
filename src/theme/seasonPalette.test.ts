import { describe, expect, it } from "vitest";

import { isSeasonPalette, resolvePalette, SEASON_COLOR_KEYS } from "./seasonPalette";
import { tokens } from "./tokens";

describe("resolvePalette (#199)", () => {
  it("sin temporada devuelve la paleta de siempre, el mismo objeto", () => {
    expect(resolvePalette({ dark: false, paletteKey: null })).toBe(tokens.color);
    expect(resolvePalette({ dark: true, paletteKey: undefined })).toBe(tokens.night.color);
  });

  it("un nombre desconocido no pisa nada", () => {
    expect(resolvePalette({ dark: false, paletteKey: "carnaval" })).toBe(tokens.color);
    expect(resolvePalette({ dark: true, paletteKey: "toString" })).toBe(tokens.night.color);
    expect(resolvePalette({ dark: false, paletteKey: "__proto__" })).toBe(tokens.color);
    expect(resolvePalette({ dark: false, paletteKey: "" })).toBe(tokens.color);
  });

  it("de día pisa solo accent, accentDeep, bg y surfaceSunk", () => {
    const palette = resolvePalette({ dark: false, paletteKey: "reforma" });
    expect(palette).toEqual({ ...tokens.color, ...tokens.season.reforma.day });
    expect(palette.ink).toBe(tokens.color.ink);
    expect(palette.surface).toBe(tokens.color.surface);
  });

  it("de noche usa la capa de noche encima de la paleta de noche", () => {
    const palette = resolvePalette({ dark: true, paletteKey: "adviento" });
    expect(palette).toEqual({ ...tokens.night.color, ...tokens.season.adviento.night });
    expect(palette.ink).toBe(tokens.night.color.ink);
  });

  it("no cambia los tokens de origen", () => {
    const before = JSON.stringify(tokens);
    resolvePalette({ dark: false, paletteKey: "gratitud" });
    resolvePalette({ dark: true, paletteKey: "gratitud" });
    expect(JSON.stringify(tokens)).toBe(before);
  });

  it("cada paleta de temporada trae exactamente las llaves permitidas, de día y de noche", () => {
    for (const [name, season] of Object.entries(tokens.season)) {
      expect(isSeasonPalette(name)).toBe(true);
      expect(Object.keys(season.day).sort()).toEqual([...SEASON_COLOR_KEYS].sort());
      expect(Object.keys(season.night).sort()).toEqual([...SEASON_COLOR_KEYS].sort());
    }
  });
});
