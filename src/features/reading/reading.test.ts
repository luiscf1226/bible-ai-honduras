import { describe, expect, it } from "vitest";

import { parsePassageQuery, searchBookSections } from "./bookSearch";
import { nextChapter, parseChapterParams, previousChapter } from "./chapterNavigation";
import { highlightSegments } from "./highlight";
import { clampFontStep, clampSpacingStep, readingTypeStyle, stepTowards } from "./readingSettings";

describe("buscador de Lectura (#112)", () => {
  it("filtra Salmos por abreviatura localmente y conserva los testamentos", () => {
    const startedAt = performance.now();
    const sections = searchBookSections("sal");
    expect(performance.now() - startedAt).toBeLessThan(100);
    expect(sections).toContainEqual({
      testament: "antiguo",
      title: "Antiguo Testamento",
      books: expect.arrayContaining([expect.objectContaining({ name: "Salmos" })]),
    });
  });

  it("resuelve referencias por nombre o abreviatura y rechaza capítulos imposibles", () => {
    expect(parsePassageQuery("Juan 3:16")).toEqual({ book: "Juan", chapter: 3, verse: 16 });
    expect(parsePassageQuery("1co 13")).toEqual({ book: "1 Corintios", chapter: 13 });
    expect(parsePassageQuery("Juan 99")).toBeNull();
  });

  it("resalta resultados sin alterar el texto original", () => {
    expect(highlightSegments("Porque de tal manera amó Dios", "amo")).toEqual([
      { text: "Porque de tal manera ", match: false },
      { text: "amó", match: true },
      { text: " Dios", match: false },
    ]);
  });
});

describe("lector por capítulo (#113)", () => {
  it("cruza los bordes de libro y protege los extremos del canon", () => {
    expect(nextChapter({ book: "Génesis", chapter: 50 })).toEqual({ book: "Éxodo", chapter: 1 });
    expect(previousChapter({ book: "Éxodo", chapter: 1 })).toEqual({ book: "Génesis", chapter: 50 });
    expect(previousChapter({ book: "Génesis", chapter: 1 })).toBeNull();
    expect(nextChapter({ book: "Apocalipsis", chapter: 22 })).toBeNull();
  });

  it("valida parámetros de deep links", () => {
    expect(parseChapterParams({ book: "Juan", chapter: "3" })).toEqual({ book: "Juan", chapter: 3 });
    expect(parseChapterParams({ book: "Juan", chapter: "99" })).toBeNull();
  });

  it("clampa los controles de lectura y escala desde los tokens", () => {
    expect(clampFontStep(99)).toBe(3);
    expect(clampSpacingStep(-1)).toBe(0);
    expect(stepTowards(0, -1, 4)).toBe(0);
    expect(stepTowards(3, 1, 4)).toBe(3);
    expect(readingTypeStyle(1, 1).fontSize).toBeGreaterThan(0);
  });
});
