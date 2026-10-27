import { describe, expect, it } from "vitest";

import { tokens } from "../theme/tokens";
import { kenBurnsPath } from "./kenBurns";

describe("paseo de la imagen (Ken Burns)", () => {
  it("cada semilla se mueve siempre igual", () => {
    expect(kenBurnsPath("Juan 14:27")).toEqual(kenBurnsPath("Juan 14:27"));
  });

  it("imágenes distintas pasean hacia lados distintos", () => {
    const paths = new Set(
      ["Juan 14:27", "Salmos 23:1", "Isaías 40:31", "Romanos 8:28", "Mateo 11:28", "Filipenses 4:13"].map((seed) =>
        JSON.stringify(kenBurnsPath(seed)),
      ),
    );
    expect(paths.size).toBeGreaterThan(2);
  });

  it("el zoom alcanza para que el paseo nunca muestre el borde", () => {
    const { dx, dy, toScale } = kenBurnsPath("Salmos 23:1");
    // Imagen más chica del feed o de Historias (~300 px): el borde extra al zoom mínimo y máximo.
    const side = 300;
    const startScale = toScale - (toScale - 1) / 2;
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const scale = startScale + (toScale - startScale) * progress;
      const margin = ((scale - 1) * side) / 2;
      expect(Math.abs(dx) * progress).toBeLessThanOrEqual(margin + 0.01);
      expect(Math.abs(dy) * progress).toBeLessThanOrEqual(margin + 0.01);
    }
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(tokens.motion.kenBurnsShift);
  });
});
