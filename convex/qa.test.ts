import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { EMBEDDING_DIMENSIONS, VOYAGE_EMBEDDINGS_URL, zeroEmbedding } from "./rag/embed";
import { QUOTA_LIMITS } from "./quotas";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./qa.ts": () => import("./qa"),
  "./users.ts": () => import("./users"),
  "./quotas.ts": () => import("./quotas"),
  "./entitlements.ts": () => import("./entitlements"),
  "./devotional.ts": () => import("./devotional"),
  "./devotionalCatalog.ts": () => import("./devotionalCatalog"),
  "./rag/embed.ts": () => import("./rag/embed"),
  "./rag/verses.ts": () => import("./rag/verses"),
  "./rag/retrieve.ts": () => import("./rag/retrieve"),
  "./rag/commentary.ts": () => import("./rag/commentary"),
  "./rag/llm.ts": () => import("./rag/llm"),
  "./rag/answer.ts": () => import("./rag/answer"),
  "./rag/prompts/qa.ts": () => import("./rag/prompts/qa"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const DEFAULT_CITATION = { book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" };

function stubExternalApis(
  options: { queryEmbedding?: number[]; answerText?: string; citations?: Array<Record<string, unknown>> } = {},
) {
  const queryEmbedding = options.queryEmbedding ?? zeroEmbedding();
  const answerText = options.answerText ?? "El pastor cuida a quien confía en él.";
  const citations = options.citations ?? [DEFAULT_CITATION];
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === VOYAGE_EMBEDDINGS_URL) {
      return Promise.resolve(jsonResponse({ data: [{ embedding: queryEmbedding }] }));
    }
    if (url === ANTHROPIC_MESSAGES_URL) {
      return Promise.resolve(
        jsonResponse({ content: [{ type: "text", text: JSON.stringify({ answer: answerText, citations }) }] }),
      );
    }
    throw new Error(`fetch no esperado a ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubEnv() {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("VOYAGE_API_KEY", "test-key");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function seedSalmos23(t: ReturnType<typeof convexTest>, embedding: number[]) {
  await t.mutation(internal.rag.verses.upsertVerse, {
    book: "Salmos",
    chapter: 23,
    verse: 1,
    version: "RVR1960",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding,
  });
}

describe("qa.ask", () => {
  it("responde una pregunta libre, sin pasaje, y persiste el turno", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_free");
    await authed.mutation(api.users.upsert, {});
    await seedSalmos23(t, unitVector(0));
    stubExternalApis({ queryEmbedding: unitVector(0) });

    const result = await authed.action(api.qa.ask, { question: "¿Quién es mi pastor?" });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("esperado ok");
    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
    expect(result.answer).toBe("El pastor cuida a quien confía en él.");

    const thread = await authed.query(api.qa.thread, {});
    expect(thread).toHaveLength(2);
    expect(thread[0]?.role).toBe("user");
    expect(thread[1]?.role).toBe("assistant");
    expect(thread[1]?.citations?.[0]).toMatchObject({
      book: "Salmos",
      chapter: 23,
      verse: 1,
      text: "Jehová es mi pastor; nada me faltará.",
    });
  });

  it("responde con pasaje exacto (libro, capítulo y versículo elegidos en #12)", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_passage");
    await authed.mutation(api.users.upsert, {});
    await seedSalmos23(t, zeroEmbedding());
    stubExternalApis();

    const result = await authed.action(api.qa.ask, {
      question: "¿Qué significa este salmo?",
      passage: { book: "Salmos", chapter: 23, verse: 1 },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("esperado ok");
    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
  });

  it("con solo libro y capítulo (sin versículo elegido), igual recupera y responde", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_chapter_only");
    await authed.mutation(api.users.upsert, {});
    await seedSalmos23(t, unitVector(3));
    stubExternalApis({ queryEmbedding: unitVector(3) });

    const result = await authed.action(api.qa.ask, {
      question: "¿De qué trata?",
      passage: { book: "Salmos", chapter: 23 },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("esperado ok");
    expect(result.citation).toMatchObject({ book: "Salmos", chapter: 23, verse: 1 });
  });

  it("al agotar la cuota, no llama al RAG", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_limit");
    await authed.mutation(api.users.upsert, {});
    for (let i = 0; i < QUOTA_LIMITS.qa; i += 1) {
      await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    }
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.qa.ask, { question: "¿Qué dice Juan 3:16?" });

    expect(result.status).toBe("limit_reached");
    expect(result.answer).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dos preguntas seguidas quedan en el mismo hilo continuo", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_thread");
    await authed.mutation(api.users.upsert, {});
    await seedSalmos23(t, zeroEmbedding());
    stubExternalApis();

    await authed.action(api.qa.ask, { question: "¿Quién es mi pastor?" });
    await authed.action(api.qa.ask, { question: "¿Y qué más dice?" });

    const thread = await authed.query(api.qa.thread, {});
    expect(thread).toHaveLength(4);
    const conversations = await t.run((ctx) => ctx.db.query("conversations").collect());
    expect(conversations).toHaveLength(1);
  });
});
