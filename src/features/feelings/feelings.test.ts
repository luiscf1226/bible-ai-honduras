import { describe, expect, it } from "vitest";

import { FEELINGS, feelingFromParam } from "./feelings";

describe("feelingFromParam", () => {
  it("acepta un sentimiento de la lista", () => {
    expect(feelingFromParam("Ansiedad")).toBe("Ansiedad");
    expect(feelingFromParam(["Gratitud", "Miedo"])).toBe("Gratitud");
  });

  it("ignora valores que no son de la lista o que faltan", () => {
    expect(feelingFromParam("Inventado")).toBeNull();
    expect(feelingFromParam(undefined)).toBeNull();
    expect(feelingFromParam("")).toBeNull();
  });

  it("los atajos del inicio usan sentimientos reales", () => {
    for (const feeling of ["Ansiedad", "Cansancio", "Gratitud"]) {
      expect(FEELINGS).toContain(feeling);
    }
  });
});
