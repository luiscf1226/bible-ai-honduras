import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { EMBEDDING_DIMENSIONS, OPENAI_EMBEDDINGS_URL, zeroEmbedding } from "./rag/embed";
import { QUOTA_LIMITS } from "./quotas";
import { LEGACY_CONVERSATION_TITLE, conversationTitle } from "./qa";

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

const DEFAULT_CITATION = { book: "Salmos", chapter: 23, verse: 1, version: "RV1909" };

function stubExternalApis(
  options: { queryEmbedding?: number[]; answerText?: string; citations?: Array<Record<string, unknown>> } = {},
) {
  const queryEmbedding = options.queryEmbedding ?? zeroEmbedding();
  const answerText = options.answerText ?? "El pastor cuida a quien confía en él.";
  const citations = options.citations ?? [DEFAULT_CITATION];
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === OPENAI_EMBEDDINGS_URL) {
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
  vi.stubEnv("OPENAI_API_KEY", "test-key");
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
    version: "RV1909",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding,
  });
}

describe("qa.ask", () => {
  it("no consume cuota ni llama proveedores sin consentimiento", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_without_consent");
    await authed.mutation(api.users.upsert, {});
    const fetchMock = stubExternalApis();

    await expect(authed.action(api.qa.ask, { question: "texto personal" })).rejects.toThrow(
      "AI_CONSENT_REQUIRED",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    const usage = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(usage).toEqual([]);
  });

  it("responde una pregunta libre, sin pasaje, y persiste el turno", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_free");
    await authed.mutation(api.users.upsert, {});
    await authed.mutation(api.users.acceptAiConsent, {});
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
    await authed.mutation(api.users.acceptAiConsent, {});
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
    await authed.mutation(api.users.acceptAiConsent, {});
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
    await authed.mutation(api.users.acceptAiConsent, {});
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

  it("con conversationId, la segunda pregunta continúa el mismo hilo", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_thread");
    await authed.mutation(api.users.upsert, {});
    await authed.mutation(api.users.acceptAiConsent, {});
    await seedSalmos23(t, zeroEmbedding());
    stubExternalApis();

    const first = await authed.action(api.qa.ask, { question: "¿Quién es mi pastor?" });
    if (first.status !== "ok") throw new Error("esperado ok");
    const second = await authed.action(api.qa.ask, {
      question: "¿Y qué más dice?",
      conversationId: first.conversationId,
    });
    if (second.status !== "ok") throw new Error("esperado ok");

    expect(second.conversationId).toBe(first.conversationId);
    const thread = await authed.query(api.qa.thread, { conversationId: first.conversationId });
    expect(thread).toHaveLength(4);
    const conversations = await t.run((ctx) => ctx.db.query("conversations").collect());
    expect(conversations).toHaveLength(1);
  });

  it("sin conversationId, otro pasaje abre un hilo limpio y el anterior sigue en la lista (#191)", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_topics");
    await authed.mutation(api.users.upsert, {});
    await authed.mutation(api.users.acceptAiConsent, {});
    await seedSalmos23(t, zeroEmbedding());
    stubExternalApis();

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
      const genesis = await authed.action(api.qa.ask, {
        question: "¿Qué pasó en la creación?",
        passage: { book: "Génesis", chapter: 1 },
      });
      vi.setSystemTime(new Date("2026-10-02T10:05:00Z"));
      const romanos = await authed.action(api.qa.ask, {
        question: "¿Qué significa no hay condenación?",
        passage: { book: "Romanos", chapter: 8, verse: 1 },
      });
      if (genesis.status !== "ok" || romanos.status !== "ok") throw new Error("esperado ok");

      expect(romanos.conversationId).not.toBe(genesis.conversationId);
      const romanosThread = await authed.query(api.qa.thread, { conversationId: romanos.conversationId });
      expect(romanosThread.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(romanosThread[0]?.text).toBe("¿Qué significa no hay condenación?");

      const list = await authed.query(api.qa.conversations, {});
      expect(list).toEqual([
        {
          _id: romanos.conversationId,
          title: "Romanos 8:1",
          passage: { book: "Romanos", chapter: 8, verse: 1 },
          updatedAt: new Date("2026-10-02T10:05:00Z").getTime(),
          lastQuestion: "¿Qué significa no hay condenación?",
        },
        {
          _id: genesis.conversationId,
          title: "Génesis 1",
          passage: { book: "Génesis", chapter: 1 },
          updatedAt: new Date("2026-10-02T10:00:00Z").getTime(),
          lastQuestion: "¿Qué pasó en la creación?",
        },
      ]);

      // Continuar Génesis la sube al primer lugar.
      vi.setSystemTime(new Date("2026-10-02T10:10:00Z"));
      await authed.action(api.qa.ask, { question: "¿Y el día siete?", conversationId: genesis.conversationId });
      const reordered = await authed.query(api.qa.conversations, {});
      expect(reordered.map((item) => item.title)).toEqual(["Génesis 1", "Romanos 8:1"]);
      expect(reordered[0]?.lastQuestion).toBe("¿Y el día siete?");

      // Sin args, `thread` devuelve la más reciente (builds viejos).
      const latest = await authed.query(api.qa.thread, {});
      expect(latest).toHaveLength(4);
      expect(latest[0]?.conversationId).toBe(genesis.conversationId);

      const limited = await authed.query(api.qa.conversations, { limit: 1 });
      expect(limited).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("la conversación única de antes se lista como 'Conversación anterior'", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_legacy");
    const userId = await authed.mutation(api.users.upsert, {});
    const legacyId = await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", { userId, module: "qa", createdAt: 1_000 });
      await ctx.db.insert("messages", { conversationId, role: "user", text: "¿Quién escribió Génesis?" });
      await ctx.db.insert("messages", { conversationId, role: "assistant", text: "Moisés, según la tradición." });
      return conversationId;
    });

    expect(await authed.query(api.qa.conversations, {})).toEqual([
      {
        _id: legacyId,
        title: LEGACY_CONVERSATION_TITLE,
        passage: null,
        updatedAt: 1_000,
        lastQuestion: "¿Quién escribió Génesis?",
      },
    ]);
    expect(await authed.query(api.qa.thread, {})).toHaveLength(2);
  });

  it("no deja leer ni escribir en la conversación de otro usuario", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const ana = asUser(t, "qa_owner_ana");
    const beto = asUser(t, "qa_owner_beto");
    await ana.mutation(api.users.upsert, {});
    await ana.mutation(api.users.acceptAiConsent, {});
    await beto.mutation(api.users.upsert, {});
    await beto.mutation(api.users.acceptAiConsent, {});
    await seedSalmos23(t, zeroEmbedding());
    stubExternalApis();

    const anas = await ana.action(api.qa.ask, { question: "Algo privado de Ana" });
    if (anas.status !== "ok") throw new Error("esperado ok");

    expect(await beto.query(api.qa.thread, { conversationId: anas.conversationId })).toEqual([]);
    expect(await beto.query(api.qa.conversations, {})).toEqual([]);

    const fetchMock = stubExternalApis();
    await expect(
      beto.action(api.qa.ask, { question: "Me meto", conversationId: anas.conversationId }),
    ).rejects.toThrow("Conversación no encontrada");
    // Se rechaza antes de gastar cuota o llamar al RAG.
    expect(fetchMock).not.toHaveBeenCalled();
    const betoUsage = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(betoUsage.every((row) => row.count === 1)).toBe(true);
    expect(await ana.query(api.qa.thread, { conversationId: anas.conversationId })).toHaveLength(2);
  });

  it("rechaza continuar una conversación de otro módulo", async () => {
    stubEnv();
    const t = convexTest(schema, modules);
    const authed = asUser(t, "qa_wrong_module");
    const userId = await authed.mutation(api.users.upsert, {});
    await authed.mutation(api.users.acceptAiConsent, {});
    const voicesId = await t.run((ctx) =>
      ctx.db.insert("conversations", { userId, module: "voices", characterId: "moises", createdAt: Date.now() }),
    );
    stubExternalApis();

    await expect(authed.action(api.qa.ask, { question: "Hola", conversationId: voicesId })).rejects.toThrow(
      "Conversación no encontrada",
    );
    expect(await authed.query(api.qa.thread, { conversationId: voicesId })).toEqual([]);
  });
});

describe("conversationTitle", () => {
  it("usa el pasaje si viene", () => {
    expect(conversationTitle("¿De qué trata?", { book: "Juan", chapter: 3 })).toBe("Juan 3");
    expect(conversationTitle("¿De qué trata?", { book: "Juan", chapter: 3, verse: 16 })).toBe("Juan 3:16");
  });

  it("sin pasaje, usa el inicio de la pregunta cortado en una palabra", () => {
    expect(conversationTitle("  ¿Quién es mi pastor?  ")).toBe("¿Quién es mi pastor?");
    expect(conversationTitle("¿Por qué Dios permitió que José fuera vendido por sus hermanos?")).toBe(
      "¿Por qué Dios permitió que José fuera…",
    );
  });
});
