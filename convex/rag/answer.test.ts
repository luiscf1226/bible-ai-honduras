import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { EMBEDDING_DIMENSIONS, OPENAI_EMBEDDINGS_URL, zeroEmbedding } from "./embed";
import { boxVerse, isGrounded } from "./answer";
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
      citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RV1909" }],
    };
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === OPENAI_EMBEDDINGS_URL) {
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
    version: "RV1909",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding,
  });
}

function stubEnv() {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
}

describe("isGrounded", () => {
  const retrieved = [
    { _id: FAKE_VERSE_ID, book: "Salmos", chapter: 23, verse: 1, version: "RV1909", text: "...", score: 1 },
  ];

  it("es verdadero cuando las citas del modelo están todas en lo recuperado", () => {
    expect(
      isGrounded({ answer: "x", citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RV1909" }] }, retrieved),
    ).toBe(true);
  });

  it("es falso cuando el modelo cita algo fuera del contexto recuperado", () => {
    expect(
      isGrounded({ answer: "x", citations: [{ book: "Romanos", chapter: 8, verse: 28, version: "RV1909" }] }, retrieved),
    ).toBe(false);
  });

  it("es falso cuando el modelo no cita nada", () => {
    expect(isGrounded({ answer: "x", citations: [] }, retrieved)).toBe(false);
  });
});

describe("boxVerse", () => {
  const verse = (book: string, chapter: number, number: number, score: number) => ({
    _id: FAKE_VERSE_ID,
    book,
    chapter,
    verse: number,
    version: "RV1909",
    text: "...",
    score,
  });
  const jeremias = verse("Jeremías", 42, 11, 0.8);
  const isaias = verse("Isaías", 41, 10, 0.6);
  const ref = (v: { book: string; chapter: number; verse: number }) => ({ book: v.book, chapter: v.chapter, verse: v.verse, version: "RV1909" });

  it("elige el primer versículo que nombra la respuesta, aunque la búsqueda lo traiga segundo", () => {
    const answer = "Dios dice 'no temas' (Isaías 41:10) y te libra de toda mano (Jeremías 42:11).";
    expect(boxVerse({ answer, citations: [ref(jeremias), ref(isaias)] }, [jeremias, isaias])).toBe(isaias);
  });

  it("no confunde «Juan 3:16» con «1 Juan 3:16»", () => {
    const juan = verse("Juan", 3, 16, 0.9);
    const primeraJuan = verse("1 Juan", 3, 16, 0.5);
    const answer = "Como dice 1 Juan 3:16, y también Juan 3:16.";
    expect(boxVerse({ answer, citations: [ref(juan)] }, [juan, primeraJuan])).toBe(primeraJuan);
  });

  it("si la respuesta no nombra ninguno, usa la primera cita del modelo", () => {
    expect(boxVerse({ answer: "Dios está con vos.", citations: [ref(isaias)] }, [jeremias, isaias])).toBe(isaias);
  });

  it("sin nombres ni citas que coincidan, queda el más cercano de la búsqueda", () => {
    expect(boxVerse({ answer: "Dios está con vos.", citations: [] }, [jeremias, isaias])).toBe(jeremias);
  });
});

describe("rag.answer.ask", () => {
  it("con pasaje explícito, responde citando el versículo correcto", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, zeroEmbedding());
    stubExternalApis();

    const result = await t.action(internal.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RV1909", book: "Salmos", chapter: 23, verse: 1 },
    });

    expect(result.citation).toMatchObject({
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "RV1909",
      text: "Jehová es mi pastor; nada me faltará.",
    });
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it("con pregunta libre, recupera el pasaje relevante antes de responder", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, unitVector(0));
    stubExternalApis({ queryEmbedding: unitVector(0) });

    const result = await t.action(internal.rag.answer.ask, { question: "¿Quién es mi pastor?" });

    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it("nunca responde con una cita inventada cuando no hay contenido relevante", async () => {
    stubEnv();
    const t = convexTest(schema, modules); // sin versículos indexados
    const fetchMock = stubExternalApis();

    const result = await t.action(internal.rag.answer.ask, { question: "¿Cuál es la capital de Honduras?" });

    expect(result.citation).toBeNull();
    expect(result.answer.length).toBeGreaterThan(0);
    const calledAnthropic = fetchMock.mock.calls.some((call: unknown[]) => call[0] === ANTHROPIC_MESSAGES_URL);
    expect(calledAnthropic).toBe(false);
  });

  it("si el pasaje pedido no está indexado, no fabrica la cita ni intenta pasarla como correcta", async () => {
    stubEnv();
    const t = convexTest(schema, modules); // sin versículos indexados
    const fetchMock = stubExternalApis();

    const result = await t.action(internal.rag.answer.ask, {
      question: "¿Qué dice?",
      passage: { version: "RV1909", book: "Juan", chapter: 3, verse: 16 },
    });

    expect(result.citation).toBeNull();
    const calledAnthropic = fetchMock.mock.calls.some((call: unknown[]) => call[0] === ANTHROPIC_MESSAGES_URL);
    expect(calledAnthropic).toBe(false);
  });

  it("con pregunta libre, la caja muestra el versículo con el que abre la respuesta, no el más cercano de la búsqueda", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    // Jeremías 42:11 queda más cerca de la pregunta (0.8) que Isaías 41:10 (0.6).
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Jeremías",
      chapter: 42,
      verse: 11,
      version: "RV1909",
      text: "No temáis de la presencia del rey de Babilonia, del cual tenéis temor.",
      embedding: unitVector(0),
    });
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Isaías",
      chapter: 41,
      verse: 10,
      version: "RV1909",
      text: "No temas, que yo soy contigo; no desmayes, que yo soy tu Dios que te esfuerzo.",
      embedding: unitVector(1),
    });
    const query = unitVector(0).map((value, i) => (i === 0 ? 0.8 : i === 1 ? 0.6 : value));
    stubExternalApis({
      queryEmbedding: query,
      structured: {
        answer: "Dios te dice 'no temas, que yo soy contigo' (Isaías 41:10), y está con vos para librarte (Jeremías 42:11).",
        citations: [
          { book: "Jeremías", chapter: 42, verse: 11, version: "RV1909" },
          { book: "Isaías", chapter: 41, verse: 10, version: "RV1909" },
        ],
      },
    });

    const result = await t.action(internal.rag.answer.ask, { question: "¿Qué dice la Biblia cuando no puedo dejar de preocuparme?" });

    expect(result.citation).toMatchObject({ book: "Isaías", chapter: 41, verse: 10 });
  });

  it("si el modelo cita algo fuera del contexto, nunca se lo muestra al usuario — usa el fallback verificado", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    await seedVerse(t, zeroEmbedding());
    stubExternalApis({
      structured: {
        answer: "Esto viene de Romanos 8:28, no de lo que se te dio.",
        citations: [{ book: "Romanos", chapter: 8, verse: 28, version: "RV1909" }],
      },
    });

    const result = await t.action(internal.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RV1909", book: "Salmos", chapter: 23, verse: 1 },
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

    await t.action(internal.rag.answer.ask, { question: "¿Quién es mi pastor?" });

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

    const result = await t.action(internal.rag.answer.ask, {
      question: "¿Qué significa este salmo?",
      passage: { version: "RV1909", book: "Salmos", chapter: 23, verse: 1 },
    });

    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer.length).toBeGreaterThan(0);
  });
});
