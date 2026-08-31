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
  "./users.ts": () => import("../users"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

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
      version: "RV1909",
      embedding,
    });
    await t.mutation(internal.rag.verses.upsertVerse, {
      ...genesis,
      version: "RV1909",
      embedding,
    });

    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RV1909",
        book: "Juan",
        chapter: 3,
        verse: 16,
      }),
    ).resolves.toMatchObject({
      book: "Juan",
      chapter: 3,
      verse: 16,
      version: "RV1909",
      text: juan.text,
    });

    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RV1909",
        book: "Génesis",
        chapter: 1,
        verse: 1,
      }),
    ).resolves.toMatchObject({
      book: "Génesis",
      chapter: 1,
      verse: 1,
      version: "RV1909",
      text: genesis.text,
    });
  });

  it("devuelve null si la referencia no existe", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query(api.rag.verses.getByRef, {
        version: "RV1909",
        book: "Juan",
        chapter: 3,
        verse: 16,
      }),
    ).resolves.toBeNull();
  });
});

describe("verses.getById", () => {
  it("devuelve el versículo por id, sin exponer el embedding", async () => {
    const t = convexTest(schema, modules);
    const juan = sampleByRef("Juan", 3, 16);
    const id = await t.mutation(internal.rag.verses.upsertVerse, {
      ...juan,
      version: "RV1909",
      embedding: zeroEmbedding(),
    });

    const row = await t.query(api.rag.verses.getById, { id });
    expect(row).toMatchObject({ book: "Juan", chapter: 3, verse: 16, version: "RV1909", text: juan.text });
    expect(row).not.toHaveProperty("embedding");
  });

  it("devuelve null si el id no existe", async () => {
    const t = convexTest(schema, modules);
    const other = await t.mutation(internal.rag.verses.upsertVerse, {
      ...sampleByRef("Génesis", 1, 1),
      version: "RV1909",
      embedding: zeroEmbedding(),
    });
    await t.mutation(internal.rag.verses.upsertVerse, {
      ...sampleByRef("Juan", 3, 16),
      version: "RV1909",
      embedding: zeroEmbedding(),
    });
    await t.run((ctx) => ctx.db.delete(other));

    const row = await t.query(api.rag.verses.getById, { id: other });
    expect(row).toBeNull();
  });
});

describe("verses.citedForUser", () => {
  it("usa RV1909 por defecto y el bibleVersion del usuario autenticado", async () => {
    const t = convexTest(schema, modules);
    const juan = sampleByRef("Juan", 3, 16);
    await t.mutation(internal.rag.verses.upsertVerse, {
      ...juan,
      version: "RV1909",
      embedding: zeroEmbedding(),
    });

    await expect(
      t.query(api.rag.verses.citedForUser, { book: "Juan", chapter: 3, verse: 16 }),
    ).resolves.toMatchObject({
      version: "RV1909",
      verse: { text: juan.text, version: "RV1909" },
    });

    // #93 §4b: NVI no tiene corpus. Una preferencia guardada que ya no está
    // disponible degrada a RV1909 en vez de devolver `verse: null` — antes
    // ese null dejaba al usuario sin ninguna cita, para siempre y sin aviso.
    const authed = asUser(t, "user_cite");
    await authed.mutation(api.users.upsert, {});
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_cite"))
        .unique();
      await ctx.db.patch(user!._id, { bibleVersion: "NVI" });
    });

    await expect(
      authed.query(api.rag.verses.citedForUser, { book: "Juan", chapter: 3, verse: 16 }),
    ).resolves.toMatchObject({
      version: "RV1909",
      verse: { text: juan.text, version: "RV1909" },
    });
  });
});


describe("verses.listByChapter", () => {
  it("devuelve los versículos indexados de un capítulo, ordenados", async () => {
    const t = convexTest(schema, modules);
    const genesis = sampleByRef("Génesis", 1, 1);
    await t.mutation(internal.rag.verses.upsertVerse, { ...genesis, version: "RV1909", embedding: zeroEmbedding() });

    const rows = await t.query(api.rag.verses.listByChapter, { version: "RV1909", book: "Génesis", chapter: 1 });
    expect(rows).toEqual([{ book: "Génesis", chapter: 1, verse: 1, version: "RV1909", text: genesis.text }]);
  });

  it("devuelve [] si el capítulo todavía no está ingerido", async () => {
    const t = convexTest(schema, modules);
    const rows = await t.query(api.rag.verses.listByChapter, { version: "RV1909", book: "Apocalipsis", chapter: 22 });
    expect(rows).toEqual([]);
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
      version: "RV1909",
      embedding: firstEmbedding,
    });
    const secondId = await t.mutation(internal.rag.verses.upsertVerse, {
      book: juan.book,
      chapter: juan.chapter,
      verse: juan.verse,
      version: "RV1909",
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
