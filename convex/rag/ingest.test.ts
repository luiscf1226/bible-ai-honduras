import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { zeroEmbedding } from "./embed";
import { loadRvr1960Sample } from "./ingest";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/ingest.ts": () => import("./ingest"),
  "./rag/verses.ts": () => import("./verses"),
  "./rag/fixtures/rvr1960.sample.json": () => import("./fixtures/rvr1960.sample.json"),
};

describe("loadRvr1960Sample", () => {
  it("incluye las referencias mínimas en español de RV1909", () => {
    const sample = loadRvr1960Sample();
    const refs = sample.map((item) => `${item.book} ${item.chapter}:${item.verse}`);
    expect(refs).toEqual(
      expect.arrayContaining([
        "Génesis 1:1",
        "Juan 3:16",
        "Salmos 23:1",
        "Filipenses 4:13",
        "Romanos 8:28",
      ]),
    );
  });
});

describe("ingest.ingestVerses", () => {
  it("indexa la muestra y getByRef devuelve Juan 3:16 y Génesis 1:1", async () => {
    const t = convexTest(schema, modules);
    const embedding = zeroEmbedding();
    const verses = loadRvr1960Sample().map((item) => ({ ...item, embedding }));

    const result = await t.action(internal.rag.ingest.ingestVerses, { verses });
    expect(result.upserted).toBe(verses.length);

    const juan = await t.query(api.rag.verses.getByRef, {
      version: "RV1909",
      book: "Juan",
      chapter: 3,
      verse: 16,
    });
    const genesis = await t.query(api.rag.verses.getByRef, {
      version: "RV1909",
      book: "Génesis",
      chapter: 1,
      verse: 1,
    });

    expect(juan?.text).toBe(
      "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
    );
    expect(genesis?.text).toBe("En el principio creó Dios los cielos y la tierra.");
  });

  it("reingestar la misma muestra no duplica filas", async () => {
    const t = convexTest(schema, modules);
    const embedding = zeroEmbedding();
    const verses = loadRvr1960Sample().map((item) => ({ ...item, embedding }));

    await t.action(internal.rag.ingest.ingestVerses, { verses });
    await t.action(internal.rag.ingest.ingestVerses, { verses });

    const rows = await t.run((ctx) => ctx.db.query("verses").collect());
    expect(rows).toHaveLength(verses.length);
  });

  it("usa version RV1909 por defecto", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.rag.ingest.ingestVerses, {
      verses: [
        {
          book: "Salmos",
          chapter: 23,
          verse: 1,
          text: "Jehová es mi pastor; nada me faltará.",
          embedding: zeroEmbedding(),
        },
      ],
    });

    const row = await t.query(api.rag.verses.getByRef, {
      version: "RV1909",
      book: "Salmos",
      chapter: 23,
      verse: 1,
    });
    expect(row).not.toBeNull();
  });
});
