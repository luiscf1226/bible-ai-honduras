import { describe, expect, it } from "vitest";

import { parseVerseRef } from "./parseVerseRef";

describe("parseVerseRef", () => {
  it("parsea una referencia simple", () => {
    expect(parseVerseRef("Salmos 23:1")).toEqual({ book: "Salmos", chapter: 23, verse: 1 });
  });

  it("parsea libros numerados y rangos usando el primer versículo", () => {
    expect(parseVerseRef("2 Corintios 1:3-4")).toEqual({
      book: "2 Corintios",
      chapter: 1,
      verse: 3,
    });
  });

  it("devuelve null si el formato no es una cita", () => {
    expect(parseVerseRef("una pausa para hoy")).toBeNull();
  });
});
