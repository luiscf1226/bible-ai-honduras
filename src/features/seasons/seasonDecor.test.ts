import { describe, expect, it } from "vitest";

import { proposedSeasonCalendar } from "../../../convex/seasonsDraftCatalog";
import { tokens } from "../../theme/tokens";
import { GARLAND_HEIGHT, GARLAND_WIDTH, decorTones, garlandFor } from "./seasonDecor";

describe("guirnalda de temporada", () => {
  it("cada paleta de temporada tiene guirnalda y tonos de día y noche", () => {
    expect(Object.keys(tokens.seasonDecor).sort()).toEqual(Object.keys(tokens.season).sort());
    for (const name of Object.keys(tokens.season) as (keyof typeof tokens.season)[]) {
      expect(garlandFor(name)?.ornaments.length).toBeGreaterThan(0);
      expect(Object.keys(decorTones(name, false)).sort()).toEqual(["deep", "gold", "leaf", "warm"]);
      expect(Object.keys(decorTones(name, true)).sort()).toEqual(["deep", "gold", "leaf", "warm"]);
    }
  });

  it("sin paleta conocida no hay guirnalda", () => {
    expect(garlandFor(null)).toBeNull();
    expect(garlandFor("carnaval")).toBeNull();
    expect(garlandFor("__proto__")).toBeNull();
  });

  it("los adornos caen dentro del lienzo", () => {
    for (const name of Object.keys(tokens.season)) {
      for (const ornament of garlandFor(name)!.ornaments) {
        expect(ornament.x).toBeGreaterThanOrEqual(0);
        expect(ornament.x).toBeLessThanOrEqual(GARLAND_WIDTH);
        expect(ornament.y).toBeGreaterThanOrEqual(0);
        expect(ornament.y).toBeLessThanOrEqual(GARLAND_HEIGHT);
      }
    }
  });

  it("las paletas del calendario borrador existen en los tokens", () => {
    for (const season of proposedSeasonCalendar(2026)) {
      if (season.paletteKey) expect(garlandFor(season.paletteKey)).not.toBeNull();
    }
  });
});
