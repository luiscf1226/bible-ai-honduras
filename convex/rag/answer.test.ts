import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../_generated/api";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS, VOYAGE_EMBEDDINGS_URL, zeroEmbedding } from "./embed";
import { ANTHROPIC_MESSAGES_URL } from "./llm";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/verses.ts": () => import("./verses"),
  "./rag/retrieve.ts": () => import("./retrieve"),
  "./rag/llm.ts": () => import("./llm"),
  "./rag/answer.ts": () => import("./answer"),
  "./rag/prompts/qa.ts": () => import("./prompts/qa"),
};

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubExternalApis(options: { queryEmbedding?: number[]; answerText?: string } = {}) {
  const queryEmbedding = options.queryEmbedding ?? zeroEmbedding();
  const answerText = options.answerText ?? "El salmo describe a Dios como un pastor que cuida y provee.";
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === VOYAGE_EMBEDDINGS_URL) {
      return Promise.resolve(jsonResponse({ data: [{ embedding: queryEmbedding }] }));
    }
    if (url === ANTHROPIC_MESSAGES_URL) {
      return Promise.resolve(jsonResponse({ content: [{ type: "text", text: answerText }] }));
    }
    throw new Error(`fetch no esperado a ${url}`);
  });
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
    version: "RVR1960",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding,
  });
}

function stubEnv() {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("VOYAGE_API_KEY", "test-key");
}

describe("rag.answer.ask", () => {
  it("con pasaje explícito, responde citando el versículo correcto", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, zeroEmbedding());
    stubExternalApis();

    const result = await t.action(api.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RVR1960", book: "Salmos", chapter: 23, verse: 1 },
    });

    expect(result.citation).toMatchObject({
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "RVR1960",
      text: "Jehová es mi pastor; nada me faltará.",
    });
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it("con pregunta libre, recupera el pasaje relevante antes de responder", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    stubExternalApis({ queryEmbedding: unitVector(0) });

    const result = await t.action(api.rag.answer.ask, { question: "¿Quién es mi pastor?" });

    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it("nunca responde con una cita inventada cuando no hay contenido relevante", async () => {
    stubEnv();
    const t = convexTest(schema, modules); // sin versículos indexados
    const fetchMock = stubExternalApis();

    const result = await t.action(api.rag.answer.ask, { question: "¿Cuál es la capital de Honduras?" });

    expect(result.citation).toBeNull();
    expect(result.answer.length).toBeGreaterThan(0);
    // No debería llamar a Anthropic si no hay contenido bíblico al que anclar la respuesta.
    const calledAnthropic = fetchMock.mock.calls.some((call: unknown[]) => call[0] === ANTHROPIC_MESSAGES_URL);
    expect(calledAnthropic).toBe(false);
  });

  it("si el pasaje pedido no está indexado, no fabrica la cita ni intenta pasarla como correcta", async () => {
    stubEnv();
    const t = convexTest(schema, modules); // sin versículos indexados
    const fetchMock = stubExternalApis();

    const result = await t.action(api.rag.answer.ask, {
      question: "¿Qué dice?",
      passage: { version: "RVR1960", book: "Juan", chapter: 3, verse: 16 },
    });

    expect(result.citation).toBeNull();
    const calledAnthropic = fetchMock.mock.calls.some((call: unknown[]) => call[0] === ANTHROPIC_MESSAGES_URL);
    expect(calledAnthropic).toBe(false);
  });
});
