import { describe, expect, it } from "vitest";

import {
  filterIllustratedStories,
  filterTextStories,
  matchesSearch,
  testamentFromReference,
} from "./textStoryFilters";

describe("textStoryFilters", () => {
  it("matchesSearch ignora mayúsculas y acentos de consulta parcial", () => {
    expect(matchesSearch("David y Goliat", "Un pastor", "1 Samuel 17", "goliat")).toBe(true);
    expect(matchesSearch("David y Goliat", "Un pastor", "1 Samuel 17", "xyz")).toBe(false);
    expect(matchesSearch("El mar que se abrió", "", "Éxodo 14", "")).toBe(true);
  });

  it("filtra texto por testamento y búsqueda", () => {
    const stories = [
      {
        id: "a",
        title: "Noé",
        summary: "Diluvio",
        reference: "Génesis 6",
        testament: "antiguo" as const,
        book: "Génesis",
        chapter: 6,
        pages: ["p1", "p2"],
      },
      {
        id: "b",
        title: "Pentecostés",
        summary: "Espíritu",
        reference: "Hechos 2",
        testament: "nuevo" as const,
        book: "Hechos",
        chapter: 2,
        pages: ["p1", "p2"],
      },
    ];

    expect(filterTextStories(stories, { testament: "nuevo", query: "" })).toHaveLength(1);
    expect(filterTextStories(stories, { testament: "todos", query: "noe" }).map((s) => s.id)).toEqual(["a"]);
  });

  it("infiere testamento de referencias ilustradas", () => {
    expect(testamentFromReference("Éxodo 14")).toBe("antiguo");
    expect(testamentFromReference("Mateo 5–7")).toBe("nuevo");
    expect(testamentFromReference("1 Samuel 17")).toBe("antiguo");
  });

  it("filtra ilustradas por testamento", () => {
    const stories = [
      {
        id: "x",
        title: "El mar",
        summary: "Éxodo",
        reference: "Éxodo 14",
        scenes: [],
      },
      {
        id: "y",
        title: "Nacimiento",
        summary: "Lucas",
        reference: "Lucas 2",
        scenes: [],
      },
    ] as const;

    expect(filterIllustratedStories(stories, { testament: "antiguo", query: "" }).map((s) => s.id)).toEqual(["x"]);
  });
});
