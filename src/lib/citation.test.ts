import { describe, expect, it } from "vitest";

import { formatCitation } from "./citation";

describe("formatCitation", () => {
  it("libro, capítulo, versículo y versión", () => {
    expect(formatCitation({ book: "Salmos", chapter: 46, verse: 1, version: "RV1909" })).toBe("Salmos 46:1 · RV1909");
  });

  it("sin versículo, cita el capítulo", () => {
    expect(formatCitation({ book: "Romanos", chapter: 8, version: "RV1909" })).toBe("Romanos 8 · RV1909");
  });

  it("sin versión, solo la referencia", () => {
    expect(formatCitation({ book: "1 Pedro", chapter: 5, verse: 7 })).toBe("1 Pedro 5:7");
  });
});
