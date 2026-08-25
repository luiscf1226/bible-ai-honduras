import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS, zeroEmbedding } from "./embed";
import { loadRvr1960Sample } from "./ingest";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/ingest.ts": () => import("./ingest"),
  "./rag/verses.ts": () => import("./verses"),
};

function sampleByRef(book: string, chapter: number, verse: number) {
  const match = loadRvr1960Sample().find(
    (item) => item.book === book && item.chapter === chapter && item.verse === verse,
  );
  if (!match) {
    throw new Error(`Fixture sin ${book} ${chapter}:${verse}`);
  }
  return match;
}

describe("verses.getByRef", () => {
  it("devuelve el texto de Juan 3:16 y Génesis 1:1 desde la muestra", async () => {
    const t = convexTest(schema, modules);
    const embedding = zeroEmbedding();
    const juan = sampleByRef("Juan", 3, 16);
    const genesis = sampleByRef("Génesis", 1, 1);

    await t.mutation(internal.rag.verses.upsertVerse, {
      ...juan,
      version: "RVR1960",
      embedding,
    });
    await t.mutation(internal.rag.verses.upsertVerse, {
      ...genesis,
      version: "RVR1960",
      embedding,
    });

    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RVR1960",
        book: "Juan",
        chapter: 3,
        verse: 16,
      }),
    ).resolves.toMatchObject({
      book: "Juan",
      chapter: 3,
      verse: 16,
      version: "RVR1960",
      text: juan.text,
    });

    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RVR1960",
        book: "Génesis",
        chapter: 1,
        verse: 1,
      }),
    ).resolves.toMatchObject({
      book: "Génesis",
      chapter: 1,
      verse: 1,
      version: "RVR1960",
      text: genesis.text,
    });
  });

  it("devuelve null si la referencia no existe", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RVR1960",
        book: "Juan",
        chapter: 3,
        verse: 16,
      }),
    ).resolves.toBeNull();
  });
});

describe("verses.upsertVerse", () => {
  it("es idempotente: la misma referencia no duplica la fila", async () => {
    const t = convexTest(schema, modules);
    const juan = sampleByRef("Juan", 3, 16);
    const firstEmbedding = zeroEmbedding();
    const secondEmbedding = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) =>
      i === 0 ? 1 : 0,
    );

    const firstId = await t.mutation(internal.rag.verses.upsertVerse, {
      ...juan,
      version: "RVR1960",
      embedding: firstEmbedding,
    });
    const secondId = await t.mutation(internal.rag.verses.upsertVerse, {
      book: juan.book,
      chapter: juan.chapter,
      verse: juan.verse,
      version: "RVR1960",
      text: "texto actualizado",
      embedding: secondEmbedding,
    });

    expect(secondId).toBe(firstId);
    const rows = await t.run((ctx) => ctx.db.query("verses").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      text: "texto actualizado",
      embedding: secondEmbedding,
    });
  });
});
