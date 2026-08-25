import { describe, expect, it } from "vitest";

import { nightTokens } from "./nightTokens";
import { tokens } from "./tokens";

describe("nightTokens", () => {
  it("expone las mismas claves de color que el token de día", () => {
    expect(Object.keys(nightTokens.color).sort()).toEqual(Object.keys(tokens.color).sort());
  });

  it("no usa negro puro — el prototipo es noche suave", () => {
    expect(Object.values(nightTokens.color)).not.toContain("#000000");
    expect(nightTokens.color.bg).toBe("#211F1D");
    expect(nightTokens.color.surface).toBe("#292522");
    expect(nightTokens.color.ink).toBe("#EDE6DA");
    expect(nightTokens.color.accent).toBe("#C99B5E");
  });
});
