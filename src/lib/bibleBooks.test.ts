import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS, chaptersFor } from "./bibleBooks";

describe("BIBLE_BOOKS", () => {
  it("tiene los 66 libros del canon protestante, sin duplicados", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(new Set(BIBLE_BOOKS.map((book) => book.name)).size).toBe(66);
  });

  it("empieza en Génesis y termina en Apocalipsis", () => {
    expect(BIBLE_BOOKS[0].name).toBe("Génesis");
    expect(BIBLE_BOOKS[BIBLE_BOOKS.length - 1].name).toBe("Apocalipsis");
  });

  it("todos los libros tienen al menos 1 capítulo", () => {
    for (const book of BIBLE_BOOKS) {
      expect(book.chapters).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("chaptersFor", () => {
  it("devuelve la cantidad correcta de capítulos para un libro conocido", () => {
    expect(chaptersFor("Salmos")).toBe(150);
    expect(chaptersFor("Judas")).toBe(1);
  });

  it("devuelve 0 para un libro que no existe", () => {
    expect(chaptersFor("Libro inventado")).toBe(0);
  });
});
