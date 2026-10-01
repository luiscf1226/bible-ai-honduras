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
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toMatchObject([{ book: "Juan", chapter: 3, verse: 16 }]);
    await expect(ana.mutation(api.reading.toggleBookmark, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({ saved: false });
    await expect(ana.query(api.reading.bookmarks, {})).resolves.toEqual([]);
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
