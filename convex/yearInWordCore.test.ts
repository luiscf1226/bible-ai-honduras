import { describe, expect, it } from "vitest";

import { countYearInWord, isValidYearInWordYear, isYearInWordSeason, yearInWordYear } from "./yearInWordCore";

describe("temporada de Tu año en la Palabra (#183)", () => {
  it("aparece del 1 de diciembre al 31 de enero", () => {
    expect(isYearInWordSeason("2026-11-30")).toBe(false);
    expect(isYearInWordSeason("2026-12-01")).toBe(true);
    expect(isYearInWordSeason("2026-12-31")).toBe(true);
    expect(isYearInWordSeason("2027-01-01")).toBe(true);
    expect(isYearInWordSeason("2027-01-31")).toBe(true);
    expect(isYearInWordSeason("2027-02-01")).toBe(false);
    expect(isYearInWordSeason("2026-10-02")).toBe(false);
  });

  it("en enero resume el año que terminó; el resto, el año en curso", () => {
    expect(yearInWordYear("2026-12-15")).toBe(2026);
    expect(yearInWordYear("2027-01-20")).toBe(2026);
    expect(yearInWordYear("2027-02-01")).toBe(2027);
    expect(yearInWordYear("2026-10-02")).toBe(2026);
  });

  it("acepta solo años enteros razonables", () => {
    expect(isValidYearInWordYear(2026)).toBe(true);
    expect(isValidYearInWordYear(2026.5)).toBe(false);
    expect(isValidYearInWordYear(1999)).toBe(false);
    expect(isValidYearInWordYear(5000)).toBe(false);
  });
});

describe("countYearInWord", () => {
  const empty = { recents: [], planDays: [], bookmarks: [], highlights: [] };

  it("sin nada en el año, todo en cero y sin versículo", () => {
    expect(countYearInWord(empty, 2026)).toEqual({
      year: 2026,
      chaptersRead: 0,
      planDays: 0,
      savedVerses: 0,
      topHighlight: null,
    });
  });

  it("cuenta solo lo que cae en el año pedido", () => {
    const counts = countYearInWord(
      {
        recents: [
          { book: "Juan", chapter: 3, day: "2026-03-01" },
          { book: "Juan", chapter: 4, day: "2026-12-31" },
          { book: "Génesis", chapter: 1, day: "2025-12-31" },
          { book: "Rut", chapter: 1, day: "2027-01-01" },
        ],
        planDays: ["2026-01-01", "2026-01-02", "2025-12-31", "2027-01-01"],
        bookmarks: ["2026-05-05", "2024-05-05"],
        highlights: [],
      },
      2026,
    );
    expect(counts).toMatchObject({ chaptersRead: 2, planDays: 2, savedVerses: 1 });
  });

  it("el más subrayado sale del capítulo con más subrayados, primer versículo en orden de lectura", () => {
    const counts = countYearInWord(
      {
        ...empty,
        highlights: [
          { book: "Juan", chapter: 3, verse: 16, day: "2026-06-01", updatedAt: 10 },
          { book: "Salmos", chapter: 46, verse: 10, day: "2026-02-01", updatedAt: 1 },
          { book: "Salmos", chapter: 46, verse: 1, day: "2026-02-02", updatedAt: 2 },
          // De otro año: no suma.
          { book: "Juan", chapter: 3, verse: 17, day: "2025-06-01", updatedAt: 0 },
          { book: "Juan", chapter: 3, verse: 18, day: "2025-06-01", updatedAt: 0 },
        ],
      },
      2026,
    );
    expect(counts.topHighlight).toEqual({ book: "Salmos", chapter: 46, verse: 1, chapterCount: 2 });
  });

  it("empate entre capítulos → gana el tocado más recientemente", () => {
    const counts = countYearInWord(
      {
        ...empty,
        highlights: [
          { book: "Salmos", chapter: 23, verse: 1, day: "2026-02-01", updatedAt: 1 },
          { book: "Romanos", chapter: 8, verse: 28, day: "2026-09-01", updatedAt: 9 },
        ],
      },
      2026,
    );
    expect(counts.topHighlight).toMatchObject({ book: "Romanos", chapter: 8, verse: 28, chapterCount: 1 });
  });
});
