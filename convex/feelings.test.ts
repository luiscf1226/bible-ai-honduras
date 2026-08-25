import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { buildFeelingQuestion, prayerForFeeling } from "./feelings";
import { ANTHROPIC_MESSAGES_URL } from "./rag/llm";
import { EMBEDDING_DIMENSIONS, VOYAGE_EMBEDDINGS_URL, zeroEmbedding } from "./rag/embed";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./feelings.ts": () => import("./feelings"),
  "./history.ts": () => import("./history"),
  "./quotas.ts": () => import("./quotas"),
  "./entitlements.ts": () => import("./entitlements"),
  "./devotional.ts": () => import("./devotional"),
  "./devotionalCatalog.ts": () => import("./devotionalCatalog"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
  "./rag/answer.ts": () => import("./rag/answer"),
  "./rag/embed.ts": () => import("./rag/embed"),
  "./rag/llm.ts": () => import("./rag/llm"),
  "./rag/prompts/qa.ts": () => import("./rag/prompts/qa"),
  "./rag/retrieve.ts": () => import("./rag/retrieve"),
  "./rag/verses.ts": () => import("./rag/verses"),
};

const generateFeeling = makeFunctionReference<
  "action",
  { feelings: string[]; note?: string },
  | {
      allowed: true;
      conversationId: string;
      devotional: {
        citation: { book: string; chapter: number; verse: number; version: string; text: string };
        prayer: string;
        reflection: string;
        title: string;
      };
    }
  | { allowed: false; reason: "limit_reached"; module: "feelings" }
>("feelings:generate");

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function unitVector(index: number) {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, position) => (position === index ? 1 : 0));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("feelings.generate", () => {
  it("reutiliza rag.answer, conserva una cita real y agrega una oración corta", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchMock = vi.fn((url: string) => {
      if (url === VOYAGE_EMBEDDINGS_URL) return Promise.resolve(jsonResponse({ data: [{ embedding: unitVector(0) }] }));
      if (url === ANTHROPIC_MESSAGES_URL) {
        const structured = {
          answer: "Dios cuida a su pueblo aun cuando el camino pesa.",
          citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" }],
        };
        return Promise.resolve(jsonResponse({ content: [{ type: "text", text: JSON.stringify(structured) }] }));
      }
      throw new Error(`fetch no esperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    const user = asUser(t, "feeling_user");
    await user.mutation(api.users.upsert, {});
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "RVR1960",
      text: "Jehová es mi pastor; nada me faltará.",
      embedding: unitVector(0),
    });

    const result = await user.action(generateFeeling, {
      feelings: ["Ansiedad"],
      note: "No logro dormir pensando en mi familia.",
    });

    expect(result).toMatchObject({
      allowed: true,
      devotional: {
        citation: { book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" },
        reflection: "Dios cuida a su pueblo aun cuando el camino pesa.",
        title: "Para ansiedad",
      },
    });
    if (!result.allowed) throw new Error("La cuota debería permitir la primera generación.");
    expect(result.devotional.prayer).toContain("Amén.");
    const history = await user.query(api.history.list, {});
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ module: "feelings", preview: result.devotional.reflection });
    expect(fetchMock.mock.calls.some(([url]) => url === ANTHROPIC_MESSAGES_URL)).toBe(true);
  });

  it("no genera un devocional sin una cita recuperada", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("VOYAGE_API_KEY", "test-key");
    const fetchMock = vi.fn((url: string) => {
      if (url === VOYAGE_EMBEDDINGS_URL) return Promise.resolve(jsonResponse({ data: [{ embedding: zeroEmbedding() }] }));
      throw new Error(`fetch no esperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules);
    const user = asUser(t, "feeling_no_citation");
    await user.mutation(api.users.upsert, {});

    await expect(user.action(generateFeeling, { feelings: ["Miedo"] })).rejects.toThrow("No encontramos un pasaje");
    expect(fetchMock.mock.calls.some(([url]) => url === ANTHROPIC_MESSAGES_URL)).toBe(false);
  });

  it("detiene el RAG cuando el límite compartido ya se agotó", async () => {
    const t = convexTest(schema, modules);
    const user = asUser(t, "feeling_limited");
    await user.mutation(api.users.upsert, {});
    for (let index = 0; index < 3; index += 1) {
      await user.mutation(api.quotas.checkAndConsume, { module: "feelings" });
    }
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(user.action(generateFeeling, { feelings: ["Miedo"] })).resolves.toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "feelings",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("contenido de sentimiento", () => {
  it("incluye el contexto de la persona y no usa un modelo adicional para la oración", () => {
    const input = { feelings: ["Duelo"], note: "Extraño a mi papá." };
    expect(buildFeelingQuestion(input)).toContain("Duelo");
    expect(buildFeelingQuestion(input)).toContain("Extraño a mi papá.");
    expect(prayerForFeeling(input)).toContain("duelo");
  });
});
