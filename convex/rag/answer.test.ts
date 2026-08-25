import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS, VOYAGE_EMBEDDINGS_URL, zeroEmbedding } from "./embed";
import { isGrounded } from "./answer";
import { ANTHROPIC_MODEL } from "./llm";

const FAKE_VERSE_ID = "verse_fake" as Id<"verses">;

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/verses.ts": () => import("./verses"),
  "./rag/retrieve.ts": () => import("./retrieve"),
  "./rag/commentary.ts": () => import("./commentary"),
  "./rag/llm.ts": () => import("./llm"),
  "./rag/answer.ts": () => import("./answer"),
  "./rag/prompts/qa.ts": () => import("./prompts/qa"),
};

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function anthropicPayload(structured: unknown) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: ANTHROPIC_MODEL,
    content: [{ type: "text", text: JSON.stringify(structured) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function stubExternalApis(options: { queryEmbedding?: number[]; structured?: unknown } = {}) {
  const queryEmbedding = options.queryEmbedding ?? zeroEmbedding();
  const structured =
    options.structured ??
    {
      answer: "El salmo describe a Dios como un pastor que cuida y provee.",
      citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" }],
    };
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === VOYAGE_EMBEDDINGS_URL) {
      return Promise.resolve(jsonResponse({ data: [{ embedding: queryEmbedding }] }));
    }
    if (url === ANTHROPIC_MESSAGES_URL) {
      return Promise.resolve(jsonResponse(anthropicPayload(structured)));
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

describe("isGrounded", () => {
  const retrieved = [
    { _id: FAKE_VERSE_ID, book: "Salmos", chapter: 23, verse: 1, version: "RVR1960", text: "...", score: 1 },
  ];

  it("es verdadero cuando las citas del modelo están todas en lo recuperado", () => {
    expect(
      isGrounded({ answer: "x", citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" }] }, retrieved),
    ).toBe(true);
  });

  it("es falso cuando el modelo cita algo fuera del contexto recuperado", () => {
    expect(
      isGrounded({ answer: "x", citations: [{ book: "Romanos", chapter: 8, verse: 28, version: "RVR1960" }] }, retrieved),
    ).toBe(false);
  });

  it("es falso cuando el modelo no cita nada", () => {
    expect(isGrounded({ answer: "x", citations: [] }, retrieved)).toBe(false);
  });
});

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

  it("si el modelo cita algo fuera del contexto, nunca se lo muestra al usuario — usa el fallback verificado", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, zeroEmbedding());
    stubExternalApis({
      structured: {
        answer: "Esto viene de Romanos 8:28, no de lo que se te dio.",
        citations: [{ book: "Romanos", chapter: 8, verse: 28, version: "RVR1960" }],
      },
    });

    const result = await t.action(api.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RVR1960", book: "Salmos", chapter: 23, verse: 1 },
    });

    // La cita estructural sigue siendo la real (Salmos 23:1) — nunca la que
    // el modelo inventó — y la respuesta no repite el texto no verificado.
    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer).not.toContain("Romanos 8:28");
    expect(result.answer).toContain("Jehová es mi pastor");
  });

  it("cuando hay comentario relevante (#6), lo incluye en el prompt como contexto adicional", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    await t.mutation(internal.rag.commentary.upsertCommentary, {
      source: "Comentario de referencia (muestra)",
      book: "Salmos",
      chapter: 23,
      text: "La imagen del pastor viene de la experiencia diaria de David.",
      embedding: unitVector(0),
    });
    const fetchMock = stubExternalApis({ queryEmbedding: unitVector(0) });

    await t.action(api.rag.answer.ask, { question: "¿Quién es mi pastor?" });

    const anthropicCall = fetchMock.mock.calls.find((call: unknown[]) => call[0] === ANTHROPIC_MESSAGES_URL);
    const body = JSON.parse(String((anthropicCall as [string, RequestInit])[1].body)) as {
      messages: Array<{ content: string }>;
    };
    expect(body.messages[0].content).toContain("La imagen del pastor viene de la experiencia diaria de David.");
  });

  it("sin comentario relevante, responde igual solo con el versículo", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, zeroEmbedding()); // sin comentarios indexados
    stubExternalApis();

    const result = await t.action(api.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RVR1960", book: "Salmos", chapter: 23, verse: 1 },
    });

    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer.length).toBeGreaterThan(0);
  });
});
