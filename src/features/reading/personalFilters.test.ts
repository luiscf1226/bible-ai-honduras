import { describe, expect, it } from "vitest";

import { bookmarkFilterFromParam, countByColor, filterBookmarks, filterHighlights, matchesQuery } from "./personalFilters";

const juan = { book: "Juan", chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo", note: null };
const salmo = { book: "Salmos", chapter: 23, verse: 1, text: "Jehová es mi pastor; nada me faltará.", note: "Lo predicó el pastor el domingo" };
const sinTexto = { book: "Filipenses", chapter: 4, verse: 13, text: null, note: "Para la entrevista de trabajo" };

describe("matchesQuery", () => {
  it("sin búsqueda pasa todo", () => {
    expect(matchesQuery(juan, "")).toBe(true);
    expect(matchesQuery(juan, "   ")).toBe(true);
  });

  it("busca en la referencia, el texto y la nota, sin tildes ni mayúsculas", () => {
    expect(matchesQuery(juan, "juan 3:16")).toBe(true);
    expect(matchesQuery(juan, "AMO")).toBe(true);
    expect(matchesQuery(salmo, "jehova")).toBe(true);
    expect(matchesQuery(salmo, "domingo")).toBe(true);
    expect(matchesQuery(sinTexto, "entrevista")).toBe(true);
    expect(matchesQuery(juan, "domingo")).toBe(false);
  });

  it("cada palabra tiene que aparecer en algún lado", () => {
    expect(matchesQuery(salmo, "pastor domingo")).toBe(true);
    expect(matchesQuery(salmo, "pastor lunes")).toBe(false);
  });
});

describe("filterBookmarks", () => {
  const items = [juan, salmo, sinTexto];

  it("'Con nota' deja solo los que tienen nota", () => {
    expect(filterBookmarks(items, { query: "", filter: "con-nota" })).toEqual([salmo, sinTexto]);
  });

  it("combina filtro y búsqueda", () => {
    expect(filterBookmarks(items, { query: "trabajo", filter: "con-nota" })).toEqual([sinTexto]);
    expect(filterBookmarks(items, { query: "mundo", filter: "con-nota" })).toEqual([]);
    expect(filterBookmarks(items, { query: "mundo", filter: "todos" })).toEqual([juan]);
  });
});

describe("filterHighlights", () => {
  const items = [
    { ...juan, color: "amber" as const },
    { ...salmo, color: "sage" as const },
    { ...sinTexto, color: "sage" as const },
  ];

  it("filtra por color y por búsqueda", () => {
    expect(filterHighlights(items, { query: "", color: "sage" }).map((item) => item.book)).toEqual(["Salmos", "Filipenses"]);
    expect(filterHighlights(items, { query: "pastor", color: "sage" }).map((item) => item.book)).toEqual(["Salmos"]);
    expect(filterHighlights(items, { query: "", color: "todos" })).toHaveLength(3);
    expect(filterHighlights(items, { query: "", color: "clay" })).toEqual([]);
  });

  it("countByColor cuenta todos los colores, aunque estén en cero", () => {
    expect(countByColor(items)).toEqual({ amber: 1, sage: 2, clay: 0, sand: 0 });
  });
});

describe("bookmarkFilterFromParam (#193)", () => {
  it("?filtro=con-nota abre Guardados con solo los que tienen nota", () => {
    expect(bookmarkFilterFromParam("con-nota")).toBe("con-nota");
    expect(bookmarkFilterFromParam(["con-nota"])).toBe("con-nota");
  });

  it("sin parámetro o con uno desconocido, muestra todos", () => {
    expect(bookmarkFilterFromParam(undefined)).toBe("todos");
    expect(bookmarkFilterFromParam("inventado")).toBe("todos");
  });
});
