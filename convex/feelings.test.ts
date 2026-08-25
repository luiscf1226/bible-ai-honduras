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
  {
    citation: { book: string; chapter: number; verse: number; version: string; text: string };
    prayer: string;
    reflection: string;
    title: string;
  }
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
      if (url === ANTHROPIC_MESSAGES_URL) return Promise.resolve(jsonResponse({ content: [{ type: "text", text: "Dios cuida a su pueblo aun cuando el camino pesa." }] }));
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
      citation: { book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" },
      reflection: "Dios cuida a su pueblo aun cuando el camino pesa.",
      title: "Para ansiedad",
    });
    expect(result.prayer).toContain("Amén.");
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
});

describe("contenido de sentimiento", () => {
  it("incluye el contexto de la persona y no usa un modelo adicional para la oración", () => {
    const input = { feelings: ["Duelo"], note: "Extraño a mi papá." };
    expect(buildFeelingQuestion(input)).toContain("Duelo");
    expect(buildFeelingQuestion(input)).toContain("Extraño a mi papá.");
    expect(prayerForFeeling(input)).toContain("duelo");
  });
});
