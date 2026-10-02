import { describe, expect, it } from "vitest";

import { tokens } from "../../theme/tokens";
import { SEASON_LINES, seasonDateRange, seasonLine } from "./seasonCopy";

describe("franja de temporada (#199)", () => {
  it("cada paleta de tokens tiene su línea curada", () => {
    expect(Object.keys(SEASON_LINES).sort()).toEqual(Object.keys(tokens.season).sort());
    for (const line of Object.values(SEASON_LINES)) expect(line.length).toBeGreaterThan(0);
  });

  it("con paleta conocida usa su línea", () => {
    expect(seasonLine({ paletteKey: "reforma", startDate: "2026-10-01", endDate: "2026-10-31" })).toBe(SEASON_LINES.reforma);
  });

  it("sin paleta o con una desconocida muestra las fechas", () => {
    expect(seasonLine({ paletteKey: null, startDate: "2026-11-01", endDate: "2026-11-30" })).toBe("Del 1 al 30 de noviembre");
    expect(seasonLine({ paletteKey: "carnaval", startDate: "2027-03-21", endDate: "2027-03-28" })).toBe("Del 21 al 28 de marzo");
  });

  it("un rango que cruza meses nombra los dos", () => {
    expect(seasonDateRange("2027-03-29", "2027-04-05")).toBe("Del 29 de marzo al 5 de abril");
  });

  it("una fecha mal formada no rompe: no hay línea", () => {
    expect(seasonDateRange("2026-13-01", "2026-10-31")).toBeNull();
    expect(seasonLine({ paletteKey: null, startDate: "ayer", endDate: "hoy" })).toBeNull();
  });
});
