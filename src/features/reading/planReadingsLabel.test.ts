import { describe, expect, it } from "vitest";

import { formatReadingsLabel, readingTarget } from "./planReadingsLabel";

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

  it("muestra un pasaje con sus versículos (recorridos, #115)", () => {
    expect(formatReadingsLabel([{ book: "Mateo", chapter: 6, verseStart: 25, verseEnd: 34 }])).toBe("Mateo 6:25-34");
  });

  it("un pasaje de un solo versículo no lleva guion", () => {
    expect(formatReadingsLabel([{ book: "Juan", chapter: 3, verseStart: 16, verseEnd: 16 }])).toBe("Juan 3:16");
  });

  it("no comprime un pasaje con el capítulo siguiente del mismo libro", () => {
    expect(
      formatReadingsLabel([
        { book: "Mateo", chapter: 5, verseStart: 1, verseEnd: 12 },
        { book: "Mateo", chapter: 6 },
        { book: "Mateo", chapter: 7 },
      ]),
    ).toBe("Mateo 5:1-12, Mateo 6-7");
  });
});

describe("readingTarget", () => {
  it("un capítulo completo abre el capítulo sin versículo", () => {
    expect(readingTarget({ book: "Salmos", chapter: 23 })).toEqual({ book: "Salmos", chapter: 23 });
  });

  it("un pasaje abre el lector en verseStart", () => {
    expect(readingTarget({ book: "Mateo", chapter: 6, verseStart: 25, verseEnd: 34 })).toEqual({
      book: "Mateo",
      chapter: 6,
      verse: 25,
    });
  });
});
