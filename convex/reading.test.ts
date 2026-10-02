import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./reading.ts": () => import("./reading"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

describe("reading — progreso, recientes y guardados", () => {
  it("persiste un único marcador por usuario y lo expone al reabrir", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_ana");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.saveProgress, { book: "Juan", chapter: 3 });
    await ana.mutation(api.reading.saveProgress, { book: "Juan", chapter: 4 });

    await expect(ana.query(api.reading.progress, {})).resolves.toMatchObject({ book: "Juan", chapter: 4 });
    expect(await t.run((ctx) => ctx.db.query("readingProgress").collect())).toHaveLength(1);
  });

  it("guarda recientes sin duplicar y alterna un versículo guardado", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_lists");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.recordRecent, { book: "Juan", chapter: 3 });
    await ana.mutation(api.reading.recordRecent, { book: "Juan", chapter: 3 });
    await expect(ana.query(api.reading.recents, {})).resolves.toHaveLength(1);

    await expect(ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ saved: true });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toMatchObject({
      total: 1,
      items: [{ book: "Juan", chapter: 3, verse: 16 }],
    });
    await expect(ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ saved: false });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toEqual({ total: 0, items: [] });
  });

  it("el separador es uno solo: moverlo lo saca del versículo anterior", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_separator");
    await ana.mutation(api.users.upsert, {});

    await expect(ana.query(api.reading.separator, {})).resolves.toBeNull();
    await ana.mutation(api.reading.setSeparator, { book: "Juan", chapter: 3, verse: 16 });
    await ana.mutation(api.reading.setSeparator, { book: "Romanos", chapter: 8, verse: 28 });

    await expect(ana.query(api.reading.separator, {})).resolves.toMatchObject({ book: "Romanos", chapter: 8, verse: 28 });
    expect(await t.run((ctx) => ctx.db.query("readingSeparators").collect())).toHaveLength(1);
  });

  it("el separador no se mueve solo al leer otro capítulo", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_separator_stays");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.setSeparator, { book: "Salmos", chapter: 23, verse: 1 });
    await ana.mutation(api.reading.saveProgress, { book: "Génesis", chapter: 1 });

    await expect(ana.query(api.reading.separator, {})).resolves.toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    await expect(ana.query(api.reading.progress, {})).resolves.toMatchObject({ book: "Génesis", chapter: 1 });
  });

  it("quitar el separador lo borra, y quitarlo sin tener uno no falla", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_separator_clear");
    await ana.mutation(api.users.upsert, {});

    await expect(ana.mutation(api.reading.clearSeparator, {})).resolves.toBeNull();
    await ana.mutation(api.reading.setSeparator, { book: "Juan", chapter: 1, verse: 1 });
    await ana.mutation(api.reading.clearSeparator, {});
    await expect(ana.query(api.reading.separator, {})).resolves.toBeNull();
  });

  it("cada persona ve solo su separador y no se puede poner sin sesión ni en un versículo inválido", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_separator_ana");
    const beto = asUser(t, "reading_separator_beto");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.setSeparator, { book: "Rut", chapter: 1, verse: 16 });
    await expect(beto.query(api.reading.separator, {})).resolves.toBeNull();
    await expect(t.query(api.reading.separator, {})).resolves.toBeNull();
    await expect(t.mutation(api.reading.setSeparator, { book: "Rut", chapter: 1, verse: 16 })).rejects.toThrow("No autenticado");
    await expect(ana.mutation(api.reading.setSeparator, { book: "Rut", chapter: 1, verse: 0 })).rejects.toThrow("enteros");
  });

  it("no permite escribir progreso sin una cuenta autenticada", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.reading.saveProgress, { book: "Juan", chapter: 3 })).rejects.toThrow("No autenticado");
  });
});

describe("reading — subrayados (#168)", () => {
  it("subrayar, cambiar de color y quitar; el subrayado sigue ahí al volver al capítulo", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_highlight");
    await ana.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 23, verse: 1, color: "amber" });
    await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 23, verse: 4, color: "sage" });
    await expect(ana.query(api.reading.highlightsForChapter, { book: "Salmos", chapter: 23 })).resolves.toEqual(
      expect.arrayContaining([
        { verse: 1, color: "amber" },
        { verse: 4, color: "sage" },
      ]),
    );

    // Cambiar de color parchea la misma fila, no agrega otra.
    await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 23, verse: 1, color: "clay" });
    expect(await t.run((ctx) => ctx.db.query("readingHighlights").collect())).toHaveLength(2);
    await expect(ana.query(api.reading.highlights, {})).resolves.toMatchObject([
      { book: "Salmos", chapter: 23, verse: 1, color: "clay" },
      { book: "Salmos", chapter: 23, verse: 4, color: "sage" },
    ]);

    await ana.mutation(api.reading.clearHighlight, { book: "Salmos", chapter: 23, verse: 1 });
    await expect(ana.query(api.reading.highlightsForChapter, { book: "Salmos", chapter: 23 })).resolves.toEqual([
      { verse: 4, color: "sage" },
    ]);
    await expect(ana.mutation(api.reading.clearHighlight, { book: "Salmos", chapter: 23, verse: 1 })).resolves.toBeNull();
  });

  it("no mezcla capítulos y cada persona ve solo sus subrayados", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_highlight_ana");
    const beto = asUser(t, "reading_highlight_beto");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.setHighlight, { book: "Juan", chapter: 3, verse: 16, color: "amber" });
    await expect(ana.query(api.reading.highlightsForChapter, { book: "Juan", chapter: 4 })).resolves.toEqual([]);
    await expect(beto.query(api.reading.highlightsForChapter, { book: "Juan", chapter: 3 })).resolves.toEqual([]);
    await expect(t.query(api.reading.highlights, {})).resolves.toEqual([]);
    await expect(
      t.mutation(api.reading.setHighlight, { book: "Juan", chapter: 3, verse: 16, color: "amber" }),
    ).rejects.toThrow("No autenticado");
    await expect(
      ana.mutation(api.reading.setHighlight, { book: "Juan", chapter: 3, verse: 0, color: "amber" }),
    ).rejects.toThrow("enteros");
  });

  it("subrayar es gratis: no cuenta uso", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "reading_highlight_free");
    await ana.mutation(api.users.upsert, {});

    for (let verse = 1; verse <= 10; verse += 1) {
      await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 119, verse, color: "sand" });
    }
    expect(await t.run((ctx) => ctx.db.query("usage").collect())).toEqual([]);
  });
});

async function seedVerse(t: ReturnType<typeof convexTest>, ref: { version: string; book: string; chapter: number; verse: number; text: string }) {
  await t.run((ctx) => ctx.db.insert("verses", { ...ref, embedding: [] }));
}

describe("reading — guardados con texto (#166)", () => {
  it("devuelve el texto en la versión de la persona, del más reciente al más viejo", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "saved_text");
    await ana.mutation(api.users.upsert, {});
    await seedVerse(t, { version: "RV1909", book: "Juan", chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo" });

    await ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 });
    await ana.mutation(api.reading.toggleBookmark, { book: "Salmos", chapter: 23, verse: 1 });

    const saved = await ana.query(api.reading.bookmarks, {});
    expect(saved.total).toBe(2);
    expect(saved.items.map((item) => item.book)).toEqual(["Salmos", "Juan"]);
    expect(saved.items[1]).toMatchObject({ version: "RV1909", text: "Porque de tal manera amó Dios al mundo", note: null });
    // Sin texto en el corpus: null, nunca un texto inventado.
    expect(saved.items[0]?.text).toBeNull();
  });

  it("con 20 guardados y limit 3 devuelve 3 con texto y el total completo", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "saved_limit");
    await ana.mutation(api.users.upsert, {});
    for (let verse = 1; verse <= 20; verse += 1) {
      await ana.mutation(api.reading.toggleBookmark, { book: "Salmos", chapter: 119, verse });
    }

    const saved = await ana.query(api.reading.bookmarks, { limit: 3 });
    expect(saved.total).toBe(20);
    expect(saved.items).toHaveLength(3);
  });

  it("quitar desde la lista lo quita también en el lector y no lo vuelve a crear", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "saved_remove");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "Me lo dijo mi mamá" });

    await expect(ana.mutation(api.reading.removeBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ removed: true });
    await expect(ana.mutation(api.reading.removeBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ removed: false });

    await expect(ana.query(api.reading.chapterBookmarks, { book: "Juan", chapter: 3 })).resolves.toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("readingBookmarks").collect())).toHaveLength(0);
  });

  it("no expone ni quita guardados de otra persona", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "saved_ana");
    const beto = asUser(t, "saved_beto");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});
    await beto.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "De Beto" });

    await expect(ana.query(api.reading.bookmarks, {})).resolves.toEqual({ total: 0, items: [] });
    await expect(ana.mutation(api.reading.removeBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ removed: false });
    await expect(beto.query(api.reading.bookmarks, {})).resolves.toMatchObject({ total: 1, items: [{ note: "De Beto" }] });
  });
});

describe("reading — notas personales (#167)", () => {
  it("crear una nota guarda el versículo; editarla la reemplaza; vaciarla la borra sin quitar el guardado", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "note_flow");
    await ana.mutation(api.users.upsert, {});

    await expect(
      ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "  Lo predicó el pastor el domingo  " }),
    ).resolves.toEqual({ saved: true, note: "Lo predicó el pastor el domingo" });
    await expect(ana.query(api.reading.chapterBookmarks, { book: "Juan", chapter: 3 })).resolves.toEqual([
      { verse: 16, note: "Lo predicó el pastor el domingo" },
    ]);

    await ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "Me lo dijo mi mamá" });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toMatchObject({ total: 1, items: [{ note: "Me lo dijo mi mamá" }] });

    await expect(ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "   " })).resolves.toEqual({
      saved: true,
      note: null,
    });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toMatchObject({ total: 1, items: [{ note: null }] });
  });

  it("una nota vacía sobre un versículo no guardado no crea nada", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "note_empty");
    await ana.mutation(api.users.upsert, {});

    await expect(ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "" })).resolves.toEqual({
      saved: false,
      note: null,
    });
    expect(await t.run((ctx) => ctx.db.query("readingBookmarks").collect())).toHaveLength(0);
  });

  it("rechaza notas de más de 500 caracteres y pide sesión", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "note_long");
    await ana.mutation(api.users.upsert, {});

    await expect(
      ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "a".repeat(501) }),
    ).rejects.toThrow("hasta 500");
    await expect(
      ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "a".repeat(500) }),
    ).resolves.toMatchObject({ saved: true });
    await expect(t.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "x" })).rejects.toThrow(
      "No autenticado",
    );
  });
});

describe("reading — subrayados con texto", () => {
  it("trae el texto en la versión de la persona y null si no está en el corpus", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "highlight_text");
    await ana.mutation(api.users.upsert, {});
    await seedVerse(t, { version: "RV1909", book: "Juan", chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo" });

    await ana.mutation(api.reading.setHighlight, { book: "Juan", chapter: 3, verse: 16, color: "sage" });
    await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 150, verse: 6, color: "amber" });

    const result = await ana.query(api.reading.highlightsWithText, {});
    expect(result.total).toBe(2);
    const juan = result.items.find((item) => item.book === "Juan");
    expect(juan).toMatchObject({ color: "sage", version: "RV1909", text: "Porque de tal manera amó Dios al mundo" });
    expect(result.items.find((item) => item.book === "Salmos")?.text).toBeNull();
  });

  it("limit acota los items pero no el total; sin sesión no hay nada", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "highlight_text_limit");
    await ana.mutation(api.users.upsert, {});
    for (let verse = 1; verse <= 6; verse += 1) {
      await ana.mutation(api.reading.setHighlight, { book: "Salmos", chapter: 119, verse, color: "clay" });
    }

    const result = await ana.query(api.reading.highlightsWithText, { limit: 3 });
    expect(result.total).toBe(6);
    expect(result.items).toHaveLength(3);
    await expect(t.query(api.reading.highlightsWithText, {})).resolves.toEqual({ total: 0, items: [] });
  });

  it("cada persona ve solo sus subrayados", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "highlight_text_ana");
    const beto = asUser(t, "highlight_text_beto");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});
    await ana.mutation(api.reading.setHighlight, { book: "Juan", chapter: 3, verse: 16, color: "amber" });

    await expect(beto.query(api.reading.highlightsWithText, {})).resolves.toEqual({ total: 0, items: [] });
  });
});
