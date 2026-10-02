import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { parseBookPackage, chapterFromPackage, countPackageVerses } from "./offlineBiblePackage";
import { zeroEmbedding } from "./rag/embed";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./offlineBible.ts": () => import("./offlineBible"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

async function seedVerses(
  t: ReturnType<typeof convexTest>,
  rows: Array<{ book: string; chapter: number; verse: number; text: string; version?: string }>,
) {
  const embedding = zeroEmbedding();
  await t.run(async (ctx) => {
    for (const row of rows) {
      await ctx.db.insert("verses", { version: "RV1909", ...row, embedding });
    }
  });
}

describe("offlineBible — paquetes por libro (#160)", () => {
  it("sin paquetes armados, el manifiesto viene vacío", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.offlineBible.manifest, {})).resolves.toEqual({
      version: "RV1909",
      totalBytes: 0,
      totalVerses: 0,
      books: [],
    });
  });

  it("arma un paquete por libro con el texto exacto de `verses` y lo expone con su tamaño", async () => {
    const t = convexTest(schema, modules);
    // Más de una página (250) en Salmos para cruzar el corte de paginación.
    const salmos = Array.from({ length: 260 }, (_, i) => ({
      book: "Salmos",
      chapter: Math.floor(i / 10) + 1,
      verse: (i % 10) + 1,
      text: `Salmo ${Math.floor(i / 10) + 1}:${(i % 10) + 1}`,
    }));
    await seedVerses(t, [
      { book: "Juan", chapter: 3, verse: 16, text: "Porque de tal manera amó Dios al mundo…" },
      { book: "Juan", chapter: 1, verse: 1, text: "En el principio era el Verbo…" },
      ...salmos,
      // Otra versión no se mezcla.
      { book: "Juan", chapter: 3, verse: 16, text: "otra versión", version: "NVI" },
    ]);

    const built = await t.action(internal.offlineBible.buildPackages, {});
    expect(built).toMatchObject({ version: "RV1909", books: 2, verses: 262 });

    const manifest = await t.query(api.offlineBible.manifest, { version: "RV1909" });
    expect(manifest.books.map((book) => book.book).sort()).toEqual(["Juan", "Salmos"]);
    expect(manifest.totalVerses).toBe(262);
    expect(manifest.totalBytes).toBe(built.bytes);

    const juanRow = await t.run((ctx) => ctx.db.query("bibleOfflinePackages").collect());
    const juan = juanRow.find((row) => row.book === "Juan")!;
    const raw = await t.run(async (ctx) => (await ctx.storage.get(juan.storageId))!.text());
    expect(new TextEncoder().encode(raw).length).toBe(juan.bytes);
    const pkg = parseBookPackage(raw, { version: "RV1909", book: "Juan" })!;
    expect(chapterFromPackage(pkg, 3)).toEqual([
      { book: "Juan", chapter: 3, verse: 16, version: "RV1909", text: "Porque de tal manera amó Dios al mundo…" },
    ]);

    const salmosRow = juanRow.find((row) => row.book === "Salmos")!;
    const salmosRaw = await t.run(async (ctx) => (await ctx.storage.get(salmosRow.storageId))!.text());
    expect(countPackageVerses(parseBookPackage(salmosRaw)!)).toBe(260);
  });

  it("volver a armar reemplaza el paquete y borra el archivo viejo", async () => {
    const t = convexTest(schema, modules);
    await seedVerses(t, [{ book: "Rut", chapter: 1, verse: 16, text: "Tu pueblo será mi pueblo" }]);
    await t.action(internal.offlineBible.buildPackages, {});
    const [first] = await t.run((ctx) => ctx.db.query("bibleOfflinePackages").collect());

    await t.action(internal.offlineBible.buildPackages, { version: "RV1909" });
    const rows = await t.run((ctx) => ctx.db.query("bibleOfflinePackages").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].storageId).not.toBe(first.storageId);
    await expect(t.run((ctx) => ctx.storage.get(first.storageId))).resolves.toBeNull();
  });

  it("una versión sin corpus se resuelve a RV1909, como el resto de la app", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.offlineBible.manifest, { version: "NVI" })).resolves.toMatchObject({ version: "RV1909" });
  });
});
