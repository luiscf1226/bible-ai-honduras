import { describe, expect, it } from "vitest";

import { buildMySpaceSections } from "./mySpaceSections";

const empty = { separator: null, bookmarks: [], highlights: [], history: [] };

describe("Mi espacio (#169)", () => {
  it("muestra las secciones vacías con cómo empezar, en vez de esconderlas", () => {
    const sections = buildMySpaceSections(empty);
    expect(sections.map((section) => section.id)).toEqual([
      "separator",
      "bookmarks",
      "highlights",
      "feelings",
      "conversations",
    ]);
    for (const section of sections) {
      expect(section.count).toBe(0);
      expect(section.action).toBe("Empezar");
      expect(section.detail.length).toBeGreaterThan(0);
    }
  });

  it("no tiene secciones de features que todavía no existen", () => {
    const titles = buildMySpaceSections(empty).map((section) => section.title.toLowerCase());
    expect(titles.some((title) => title.includes("petici") || title.includes("memoriz") || title.includes("nota"))).toBe(false);
  });

  it("cuenta y lleva a la pantalla existente de cada sección", () => {
    const sections = buildMySpaceSections({
      separator: { book: "Salmos", chapter: 23, verse: 1 },
      bookmarks: [
        { book: "Juan", chapter: 3, verse: 16 },
        { book: "Rut", chapter: 1, verse: 16 },
      ],
      highlights: [{ book: "Romanos", chapter: 8, verse: 28 }],
      history: [
        { module: "feelings", title: "Para la ansiedad" },
        { module: "qa", title: "¿Qué es la gracia?" },
        { module: "voices", title: "Moisés" },
      ],
    });
    const byId = Object.fromEntries(sections.map((section) => [section.id, section]));

    expect(byId.separator).toMatchObject({
      count: 1,
      detail: "Salmos 23:1",
      destination: { kind: "passage", passage: { book: "Salmos", chapter: 23, verse: 1 } },
    });
    expect(byId.bookmarks).toMatchObject({ count: 2, detail: "Juan 3:16", action: "Ver todo", destination: { href: "/leer/guardados" } });
    expect(byId.highlights).toMatchObject({ count: 1, detail: "Romanos 8:28", destination: { href: "/leer/subrayados" } });
    expect(byId.feelings).toMatchObject({ count: 1, destination: { kind: "sentir", openHistory: true } });
    expect(byId.conversations).toMatchObject({ count: 2, detail: "¿Qué es la gracia?", destination: { href: "/historial" } });
  });
});
