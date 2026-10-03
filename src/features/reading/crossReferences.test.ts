import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../../lib/bibleBooks";
import crossReferencesJson from "../../../docs/content/referencias-cruzadas.json";
import {
  crossReferencesFor,
  decodeCrossReference,
  formatCrossReference,
  hasCrossReferences,
  passageVerses,
  type CrossReferenceData,
} from "./crossReferences";

describe("decodeCrossReference", () => {
  it("mapea el índice del libro al nombre del canon RV1909", () => {
    expect(decodeCrossReference("0.1.1")).toEqual({ book: "Génesis", chapter: 1, verse: 1 });
    expect(decodeCrossReference("18.23.1")).toEqual({ book: "Salmos", chapter: 23, verse: 1 });
    expect(decodeCrossReference("44.8.28")).toEqual({ book: "Romanos", chapter: 8, verse: 28 });
    expect(decodeCrossReference("65.22.21")).toEqual({ book: "Apocalipsis", chapter: 22, verse: 21 });
  });

  it("lee un rango en el mismo capítulo y uno que cruza de capítulo", () => {
    expect(decodeCrossReference("61.4.9-10")).toEqual({ book: "1 Juan", chapter: 4, verse: 9, end: { chapter: 4, verse: 10 } });
    expect(decodeCrossReference("0.1.1-2.3")).toEqual({ book: "Génesis", chapter: 1, verse: 1, end: { chapter: 2, verse: 3 } });
  });

  it("descarta lo que no está en el canon o está mal formado", () => {
    expect(decodeCrossReference("66.1.1")).toBeNull();
    expect(decodeCrossReference("0.51.1")).toBeNull();
    expect(decodeCrossReference("0.0.1")).toBeNull();
    expect(decodeCrossReference("0.1.0")).toBeNull();
    expect(decodeCrossReference("Gen.1.1")).toBeNull();
    expect(decodeCrossReference("")).toBeNull();
  });

  it("un final que no avanza se ignora y queda el versículo solo", () => {
    expect(decodeCrossReference("0.1.5-3")).toEqual({ book: "Génesis", chapter: 1, verse: 5 });
    expect(decodeCrossReference("7.1.1-9.1")).toEqual({ book: "Rut", chapter: 1, verse: 1 });
  });
});

describe("crossReferencesFor", () => {
  const data: CrossReferenceData = {
    books: [[["", "0.1.1 bad 44.8.28-30"]], [], [], []],
  };

  it("devuelve las referencias del versículo en orden y salta las inválidas", () => {
    expect(crossReferencesFor({ book: "Génesis", chapter: 1, verse: 2 }, data)).toEqual([
      { book: "Génesis", chapter: 1, verse: 1 },
      { book: "Romanos", chapter: 8, verse: 28, end: { chapter: 8, verse: 30 } },
    ]);
  });

  it("versículo, capítulo o libro sin datos → lista vacía", () => {
    expect(crossReferencesFor({ book: "Génesis", chapter: 1, verse: 1 }, data)).toEqual([]);
    expect(crossReferencesFor({ book: "Génesis", chapter: 1, verse: 99 }, data)).toEqual([]);
    expect(crossReferencesFor({ book: "Génesis", chapter: 7, verse: 1 }, data)).toEqual([]);
    expect(crossReferencesFor({ book: "Éxodo", chapter: 1, verse: 1 }, data)).toEqual([]);
    expect(crossReferencesFor({ book: "Apocalipsis", chapter: 1, verse: 1 }, data)).toEqual([]);
    expect(crossReferencesFor({ book: "Genesis", chapter: 1, verse: 2 }, data)).toEqual([]);
    expect(hasCrossReferences({ book: "Génesis", chapter: 1, verse: 1 }, data)).toBe(false);
    expect(hasCrossReferences({ book: "Génesis", chapter: 1, verse: 2 }, data)).toBe(true);
  });

  it("con el índice real, Juan 3:16 trae pasajes conocidos", () => {
    const refs = crossReferencesFor({ book: "Juan", chapter: 3, verse: 16 }).map(formatCrossReference);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.length).toBeLessThanOrEqual(5);
    expect(refs).toContain("Romanos 5:8");
  });
});

describe("índice real", () => {
  const data = crossReferencesJson as CrossReferenceData;

  it("tiene los 66 libros y ningún capítulo de más", () => {
    expect(data.books).toHaveLength(BIBLE_BOOKS.length);
    data.books.forEach((chapters, index) => {
      expect(chapters.length).toBeLessThanOrEqual(BIBLE_BOOKS[index].chapters);
    });
  });

  it("toda referencia decodifica a un pasaje del canon", () => {
    for (const chapters of data.books) {
      for (const verses of chapters) {
        for (const raw of verses) {
          if (!raw) continue;
          for (const code of raw.split(" ")) {
            expect(decodeCrossReference(code), code).not.toBeNull();
          }
        }
      }
    }
  });

  it("no apunta a los versículos de la ESV que RV1909 no tiene", () => {
    const all = data.books.flat(2).join(" ").split(" ");
    expect(all).not.toContain("63.1.15");
    expect(all).not.toContain("65.12.18");
  });
});

describe("formatCrossReference", () => {
  it("formatea versículo, rango y rango entre capítulos", () => {
    expect(formatCrossReference({ book: "Romanos", chapter: 5, verse: 8 })).toBe("Romanos 5:8");
    expect(formatCrossReference({ book: "1 Juan", chapter: 4, verse: 9, end: { chapter: 4, verse: 10 } })).toBe("1 Juan 4:9–10");
    expect(formatCrossReference({ book: "Génesis", chapter: 1, verse: 1, end: { chapter: 2, verse: 3 } })).toBe("Génesis 1:1–2:3");
  });
});

describe("passageVerses", () => {
  const chapter = [1, 2, 3, 4, 5].map((verse) => ({ verse, text: `v${verse}` }));

  it("un versículo, un rango y un rango que sigue en el próximo capítulo", () => {
    expect(passageVerses({ book: "Juan", chapter: 1, verse: 2 }, chapter).map((v) => v.verse)).toEqual([2]);
    expect(passageVerses({ book: "Juan", chapter: 1, verse: 2, end: { chapter: 1, verse: 4 } }, chapter).map((v) => v.verse)).toEqual([2, 3, 4]);
    expect(passageVerses({ book: "Juan", chapter: 1, verse: 4, end: { chapter: 2, verse: 1 } }, chapter).map((v) => v.verse)).toEqual([4, 5]);
  });

  it("un versículo que la versión no tiene no aparece", () => {
    expect(passageVerses({ book: "Juan", chapter: 1, verse: 9 }, chapter)).toEqual([]);
    expect(passageVerses({ book: "Juan", chapter: 1, verse: 4, end: { chapter: 1, verse: 8 } }, chapter).map((v) => v.verse)).toEqual([4, 5]);
  });
});
