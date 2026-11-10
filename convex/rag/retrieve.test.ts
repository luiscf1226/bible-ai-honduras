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

  it("sin embeddings (OpenAI sin saldo), recupera por referencia sugerida y descarta lo que no está en la Biblia", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    const suggestion = {
      references: [
        { book: "Salmos", chapter: 23, verse: 1 },
        { book: "Salmos", chapter: 23, verse: 1 },
        { book: "Juan", chapter: 99, verse: 1 },
      ],
    };
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("openai")
        ? new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), { status: 429 })
        : new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(suggestion) }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await t.action(internal.rag.retrieve.topVerses, { query: "¿quién es mi pastor?" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: "Salmos", chapter: 23, verse: 1, version: "RV1909" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("openai"),
      expect.stringContaining("anthropic"),
    ]);
  });
});
