import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../../lib/bibleBooks";
import { resolveBookName } from "./bookSearch";
import { booksOfSection, CANON_SECTIONS, sectionsForTestament, splitInColumns } from "./bookSections";

describe("índice de libros tipo Biblia de papel (#195)", () => {
  const listed = CANON_SECTIONS.flatMap((section) => section.books);

  it("cubre los 66 libros, cada uno una sola vez y en el orden del canon", () => {
    expect(listed).toHaveLength(66);
    expect(new Set(listed).size).toBe(66);
    expect(listed).toEqual(BIBLE_BOOKS.map((book) => book.name));
  });

  it("usa los mismos nombres que resuelve el buscador", () => {
    for (const name of listed) {
      expect(resolveBookName(name)).toBe(name);
    }
  });

  it("pone cada libro en su testamento", () => {
    for (const section of CANON_SECTIONS) {
      for (const book of booksOfSection(section)) {
        expect(book.testament).toBe(section.testament);
      }
      expect(booksOfSection(section)).toHaveLength(section.books.length);
    }
    expect(sectionsForTestament("antiguo").flatMap((s) => s.books)).toHaveLength(39);
    expect(sectionsForTestament("nuevo").flatMap((s) => s.books)).toHaveLength(27);
  });

  it("parte en dos columnas con la de la izquierda más larga", () => {
    expect(splitInColumns([1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [4, 5]]);
    expect(splitInColumns(["Apocalipsis"])).toEqual([["Apocalipsis"], []]);
  });
});
