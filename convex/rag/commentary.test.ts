import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS, zeroEmbedding } from "./embed";
import { COMMENTARY_RELEVANCE_THRESHOLD, loadCommentarySample } from "./commentary";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/commentary.ts": () => import("./commentary"),
  "./rag/fixtures/commentary.sample.json": () => import("./fixtures/commentary.sample.json"),
};

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function stubVoyage(queryEmbedding: number[]) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: [{ embedding: queryEmbedding }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function seedCommentary(t: ReturnType<typeof convexTest>, embedding: number[]) {
  return t.mutation(internal.rag.commentary.upsertCommentary, {
    source: "Comentario de referencia (muestra)",
    book: "Salmos",
    chapter: 23,
    text: "La imagen del pastor viene de la experiencia diaria de David.",
    embedding,
  });
}

describe("loadCommentarySample", () => {
  it("incluye los mismos libros que la muestra de RVR1960", () => {
    const sample = loadCommentarySample();
    const books = sample.map((item) => item.book);
    expect(books).toEqual(expect.arrayContaining(["Génesis", "Salmos", "Juan", "Romanos"]));
  });
});

describe("commentary.upsertCommentary", () => {
  it("es idempotente en (source, book, chapter)", async () => {
    const t = convexTest(schema, modules);
    const firstId = await seedCommentary(t, zeroEmbedding());
    const secondId = await t.mutation(internal.rag.commentary.upsertCommentary, {
      source: "Comentario de referencia (muestra)",
      book: "Salmos",
      chapter: 23,
      text: "Texto actualizado.",
      embedding: zeroEmbedding(),
    });

    expect(secondId).toBe(firstId);
    const rows = await t.run((ctx) => ctx.db.query("commentaries").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe("Texto actualizado.");
  });
});

describe("commentary.ingestCommentary", () => {
  it("indexa la muestra completa", async () => {
    const t = convexTest(schema, modules);
    const sample = loadCommentarySample().map((item) => ({ ...item, embedding: zeroEmbedding() }));

    const result = await t.action(internal.rag.commentary.ingestCommentary, { commentaries: sample });

    expect(result.upserted).toBe(sample.length);
    const rows = await t.run((ctx) => ctx.db.query("commentaries").collect());
    expect(rows).toHaveLength(sample.length);
  });
});

describe("retrieveCommentary", () => {
  it("devuelve el comentario cuando la similitud supera el umbral", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedCommentary(t, unitVector(0));
    stubVoyage(unitVector(0));

    const results = await t.action(api.rag.commentary.topCommentary, { query: "¿quién es mi pastor?" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: "Comentario de referencia (muestra)", book: "Salmos", chapter: 23 });
    expect(results[0].score).toBeGreaterThanOrEqual(COMMENTARY_RELEVANCE_THRESHOLD);
  });

  it("no devuelve nada por debajo del umbral — nunca fabrica un comentario", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedCommentary(t, unitVector(0));
    stubVoyage(unitVector(1)); // ortogonal

    const results = await t.action(api.rag.commentary.topCommentary, { query: "algo sin relación" });

    expect(results).toEqual([]);
  });

  it("filtra por libro cuando se pide", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedCommentary(t, unitVector(0));
    await t.mutation(internal.rag.commentary.upsertCommentary, {
      source: "Comentario de referencia (muestra)",
      book: "Juan",
      chapter: 3,
      text: "Otro comentario, en otro libro.",
      embedding: unitVector(0),
    });
    stubVoyage(unitVector(0));

    const results = await t.action(api.rag.commentary.topCommentary, { query: "cualquier cosa", book: "Salmos", limit: 5 });

    expect(results).toHaveLength(1);
    expect(results[0].book).toBe("Salmos");
  });

  it("sin comentarios indexados, devuelve [] en vez de fallar", async () => {
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const t = convexTest(schema, modules); // sin seedCommentary
    stubVoyage(unitVector(0));

    const results = await t.action(api.rag.commentary.topCommentary, { query: "¿quién es mi pastor?" });

    expect(results).toEqual([]);
  });
});
