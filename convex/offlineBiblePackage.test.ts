import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import {
  bookFileName,
  buildBookPackage,
  chapterFromPackage,
  countPackageVerses,
  formatBytes,
  parseBookPackage,
  serializeBookPackage,
  utf8ByteLength,
} from "./offlineBiblePackage";

const ROWS = [
  { chapter: 3, verse: 17, text: "Porque no envió Dios á su Hijo al mundo…" },
  { chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo…" },
  { chapter: 1, verse: 1, text: "En el principio era el Verbo…" },
];

describe("paquete de la Biblia sin conexión", () => {
  it("agrupa por capítulo y ordena por versículo", () => {
    const pkg = buildBookPackage("RV1909", "Juan", ROWS);
    expect(Object.keys(pkg.chapters)).toEqual(["1", "3"]);
    expect(pkg.chapters["3"].map(([verse]) => verse)).toEqual([16, 17]);
    expect(countPackageVerses(pkg)).toBe(3);
  });

  it("ida y vuelta: lo que se guarda es lo que se lee", () => {
    const raw = serializeBookPackage(buildBookPackage("RV1909", "Juan", ROWS));
    const pkg = parseBookPackage(raw, { version: "RV1909", book: "Juan" });
    expect(pkg).not.toBeNull();
    expect(chapterFromPackage(pkg!, 3)).toEqual([
      { book: "Juan", chapter: 3, verse: 16, version: "RV1909", text: ROWS[1].text },
      { book: "Juan", chapter: 3, verse: 17, version: "RV1909", text: ROWS[0].text },
    ]);
    expect(chapterFromPackage(pkg!, 2)).toEqual([]);
  });

  it("rechaza un archivo cortado, de otro libro o con basura", () => {
    const raw = serializeBookPackage(buildBookPackage("RV1909", "Juan", ROWS));
    expect(parseBookPackage(raw.slice(0, raw.length - 5))).toBeNull();
    expect(parseBookPackage(raw, { version: "RV1909", book: "Romanos" })).toBeNull();
    expect(parseBookPackage(raw, { version: "NVI", book: "Juan" })).toBeNull();
    expect(parseBookPackage(JSON.stringify({ format: 1, version: "RV1909", book: "Juan", chapters: {} }))).toBeNull();
    expect(parseBookPackage(JSON.stringify({ format: 1, version: "RV1909", book: "Juan", chapters: { "1": [[0, "x"]] } }))).toBeNull();
    expect(parseBookPackage(JSON.stringify({ format: 2, version: "RV1909", book: "Juan", chapters: { "1": [[1, "x"]] } }))).toBeNull();
    expect(parseBookPackage("null")).toBeNull();
  });

  it("cada libro del canon tiene un nombre de archivo propio, sin tildes ni espacios", () => {
    const names = BIBLE_BOOKS.map((book) => bookFileName(book.name));
    expect(new Set(names).size).toBe(66);
    expect(bookFileName("1 Pedro")).toBe("1-pedro.json");
    expect(bookFileName("Éxodo")).toBe("exodo.json");
    for (const name of names) expect(name).toMatch(/^[a-z0-9-]+\.json$/);
  });

  it("muestra el tamaño con coma decimal", () => {
    expect(formatBytes(4.6 * 1024 * 1024)).toBe("4,6 MB");
    expect(formatBytes(820 * 1024)).toBe("820 KB");
    expect(formatBytes(10)).toBe("1 KB");
    expect(formatBytes(0)).toBe("0 KB");
  });

  it("cuenta bytes UTF-8, no caracteres (las tildes pesan doble)", () => {
    expect(utf8ByteLength("á")).toBe(2);
    expect(utf8ByteLength("a")).toBe(1);
  });
});
