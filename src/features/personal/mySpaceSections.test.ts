import { describe, expect, it } from "vitest";

import { buildMySpaceSections } from "./mySpaceSections";

const empty = { separator: null, bookmarks: [], highlights: [], history: [], memorize: { total: 0, dueCount: 0 }, prayers: [] };

describe("Mi espacio (#169)", () => {
  it("muestra las secciones vacías con cómo empezar, en vez de esconderlas", () => {
    const sections = buildMySpaceSections(empty);
    expect(sections.map((section) => section.id)).toEqual([
      "separator",
      "bookmarks",
      "highlights",
      "memorize",
      "feelings",
      "prayers",
      "conversations",
    ]);
    for (const section of sections) {
      expect(section.count).toBe(0);
      expect(section.action).toBe("Empezar");
      expect(section.detail.length).toBeGreaterThan(0);
    }
  });

  it("Memorizar (#158): repasar si hay versículos para hoy; si no, ver todo", () => {
    const due = buildMySpaceSections({ ...empty, memorize: { total: 3, dueCount: 2 } }).find((s) => s.id === "memorize");
    expect(due).toMatchObject({ count: 3, detail: "2 versículos para repasar hoy", action: "Repasar", destination: { href: "/memorizar" } });
    const one = buildMySpaceSections({ ...empty, memorize: { total: 1, dueCount: 1 } }).find((s) => s.id === "memorize");
    expect(one?.detail).toBe("1 versículo para repasar hoy");
    const rest = buildMySpaceSections({ ...empty, memorize: { total: 3, dueCount: 0 } }).find((s) => s.id === "memorize");
    expect(rest).toMatchObject({ action: "Ver todo", detail: "Nada para repasar hoy. Volvé mañana." });
    const none = buildMySpaceSections(empty).find((s) => s.id === "memorize");
    expect(none).toMatchObject({ action: "Empezar", destination: { href: "/leer" } });
  });

  it("Diario de oración (#159): muestra la última abierta, o cuántas fueron respondidas", () => {
    const withOpen = buildMySpaceSections({
      ...empty,
      prayers: [
        { text: "Por mi abuela", answeredAt: null },
        { text: "Por el trabajo", answeredAt: 10 },
      ],
    }).find((s) => s.id === "prayers");
    expect(withOpen).toMatchObject({ count: 2, detail: "Por mi abuela", action: "Ver todo", destination: { href: "/oracion" } });
    const onlyAnswered = buildMySpaceSections({ ...empty, prayers: [{ text: "x", answeredAt: 1 }] }).find((s) => s.id === "prayers");
    expect(onlyAnswered?.detail).toBe("1 petición respondida");
    // Vacío también lleva al diario: ahí se puede escribir la primera.
    expect(buildMySpaceSections(empty).find((s) => s.id === "prayers")?.destination).toEqual({ kind: "route", href: "/oracion" });
  });

  it("cuenta y lleva a la pantalla existente de cada sección", () => {
    const sections = buildMySpaceSections({
      ...empty,
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
