import { describe, expect, it } from "vitest";

import { formatReadingsLabel } from "./planReadingsLabel";

describe("formatReadingsLabel", () => {
  it("comprime capítulos consecutivos del mismo libro en un rango", () => {
    expect(
      formatReadingsLabel([
        { book: "Génesis", chapter: 1 },
        { book: "Génesis", chapter: 2 },
        { book: "Génesis", chapter: 3 },
      ]),
    ).toBe("Génesis 1-3");
  });

  it("muestra un solo capítulo sin guion", () => {
    expect(formatReadingsLabel([{ book: "Judas", chapter: 1 }])).toBe("Judas 1");
  });

  it("separa libros distintos aunque no sean consecutivos", () => {
    expect(
      formatReadingsLabel([
        { book: "Génesis", chapter: 50 },
        { book: "Éxodo", chapter: 1 },
        { book: "Éxodo", chapter: 2 },
      ]),
    ).toBe("Génesis 50, Éxodo 1-2");
  });

  it("no junta capítulos salteados del mismo libro", () => {
    expect(
      formatReadingsLabel([
        { book: "Salmos", chapter: 1 },
        { book: "Salmos", chapter: 3 },
      ]),
    ).toBe("Salmos 1, Salmos 3");
  });

  it("arreglo vacío da texto vacío", () => {
    expect(formatReadingsLabel([])).toBe("");
  });
});
