import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "../_generated/api";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS } from "./embed";
import { RELEVANCE_THRESHOLD } from "./retrieve";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/verses.ts": () => import("./verses"),
  "./rag/retrieve.ts": () => import("./retrieve"),
};

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function stubOpenAI(queryEmbedding: number[]) {
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

async function seedVerse(t: ReturnType<typeof convexTest>, embedding: number[]) {
  await t.mutation(internal.rag.verses.upsertVerse, {
    book: "Salmos",
    chapter: 23,
    verse: 1,
    version: "RV1909",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding,
  });
}

describe("retrieve.topVerses", () => {
  it("devuelve el versículo cuando la similitud supera el umbral", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    stubOpenAI(unitVector(0));

    const results = await t.action(internal.rag.retrieve.topVerses, { query: "¿quién es mi pastor?" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(results[0].score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
    expect(typeof results[0]._id).toBe("string");
  });

  it("no devuelve nada cuando la similitud queda por debajo del umbral — nunca fabrica una cita", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    stubOpenAI(unitVector(1)); // ortogonal al versículo indexado

    const results = await t.action(internal.rag.retrieve.topVerses, { query: "algo sin relación" });

    expect(results).toEqual([]);
  });

  it("filtra por versión", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "NVI",
      text: "El Señor es mi pastor, nada me falta.",
      embedding: unitVector(0),
    });
    stubOpenAI(unitVector(0));

    const results = await t.action(internal.rag.retrieve.topVerses, { query: "mi pastor", version: "RV1909" });

    expect(results).toEqual([]);
  });
});
