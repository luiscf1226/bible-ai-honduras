import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { components, internal } from "./_generated/api";
import adminKitSchema from "./adminKit/schema";
import { priceFor } from "./adminKit/pricing";
import { STORY_IMAGE_MODEL } from "./images";
import { EMBEDDING_DIMENSIONS, OPENAI_EMBEDDING_MODEL, OPENAI_EMBEDDINGS_URL } from "./rag/embed";
import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_MODEL } from "./rag/llm";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./aiUsage.ts": () => import("./aiUsage"),
  "./rag/embed.ts": () => import("./rag/embed"),
  "./rag/verses.ts": () => import("./rag/verses"),
  "./rag/retrieve.ts": () => import("./rag/retrieve"),
  "./rag/commentary.ts": () => import("./rag/commentary"),
  "./rag/llm.ts": () => import("./rag/llm"),
  "./rag/answer.ts": () => import("./rag/answer"),
  "./rag/prompts/qa.ts": () => import("./rag/prompts/qa"),
};
const adminKitModules = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/**/*.test.ts"]);

const DAY_MS = 24 * 60 * 60 * 1000;
// Pregunta y versículo apuntan al mismo lado: la búsqueda vectorial lo encuentra.
const PASTOR = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));

function setup() {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  t.registerComponent("adminKit", adminKitSchema, adminKitModules);
  return t;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubProviders(anthropicStatus = 200, citedVerse = 1) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url === OPENAI_EMBEDDINGS_URL) {
        return Promise.resolve(jsonResponse({ data: [{ embedding: PASTOR }], usage: { total_tokens: 7 } }));
      }
      if (url === ANTHROPIC_MESSAGES_URL) {
        if (anthropicStatus !== 200) return Promise.resolve(jsonResponse({ error: {} }, anthropicStatus));
        const structured = {
          answer: "Dios cuida como un pastor.",
          citations: [{ book: "Salmos", chapter: 23, verse: citedVerse, version: "RV1909" }],
        };
        return Promise.resolve(
          jsonResponse({
            content: [{ type: "text", text: JSON.stringify(structured) }],
            usage: { input_tokens: 1_200, output_tokens: 300 },
          }),
        );
      }
      throw new Error(`fetch no esperado a ${url}`);
    }),
  );
}

async function seedVerse(t: ReturnType<typeof setup>) {
  await t.mutation(internal.rag.verses.upsertVerse, {
    book: "Salmos",
    chapter: 23,
    verse: 1,
    version: "RV1909",
    text: "Jehová es mi pastor; nada me faltará.",
    embedding: PASTOR,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("costo de la IA (#235)", () => {
  it("cada modelo que usa la app tiene precio", () => {
    expect(priceFor("anthropic", ANTHROPIC_MODEL)).toBeDefined();
    expect(priceFor("openai", OPENAI_EMBEDDING_MODEL)).toBeDefined();
    expect(priceFor("openai", STORY_IMAGE_MODEL)).toBeDefined();
  });

  it("una respuesta de Sentir deja sus llamadas con tokens y costo, a nombre de feelings", async () => {
    const t = setup();
    await seedVerse(t);
    stubProviders();

    await t.action(internal.rag.answer.ask, { question: "Me siento solo", feature: "feelings" });

    const groups = await t.query(internal.aiUsage.summary, { days: 1 });
    const llm = groups.find((group) => group.provider === "anthropic");
    const embeddings = groups.find((group) => group.provider === "openai");
    expect(llm).toMatchObject({ feature: "feelings", model: ANTHROPIC_MODEL, calls: 1, errors: 0, inputTokens: 1_200, outputTokens: 300 });
    expect(llm?.costUsd).toBeCloseTo((1_200 * 2 + 300 * 10) / 1_000_000);
    // Versículos y comentario: un embedding de la pregunta para cada búsqueda.
    expect(embeddings).toMatchObject({ feature: "feelings", model: OPENAI_EMBEDDING_MODEL, calls: 2, inputTokens: 14 });
  });

  it("sin feature, cuenta como Preguntar", async () => {
    const t = setup();
    await seedVerse(t);
    stubProviders();
    await t.action(internal.rag.answer.ask, { question: "¿Quién es mi pastor?" });
    const groups = await t.query(internal.aiUsage.summary, { days: 1 });
    expect(new Set(groups.map((group) => group.feature))).toEqual(new Set(["qa"]));
  });

  it("un fallo del proveedor queda registrado con su código, sin el texto", async () => {
    const t = setup();
    await seedVerse(t);
    stubProviders(529);

    await expect(t.action(internal.rag.answer.ask, { question: "Pregunta privada" })).rejects.toThrow("529");

    const groups = await t.query(internal.aiUsage.summary, { days: 1 });
    expect(groups.find((group) => group.provider === "anthropic")).toMatchObject({ calls: 1, errors: 1, errorKinds: { http_529: 1 } });
    expect(JSON.stringify(groups)).not.toContain("Pregunta privada");
  });

  it("purgeOld borra lo de más de 90 días y deja lo reciente", async () => {
    vi.useFakeTimers();
    const t = setup();
    const call = { provider: "p", model: "m", inputTokens: 1, outputTokens: 1, latencyMs: 1, ok: true };
    const now = Date.now();
    vi.setSystemTime(now - 91 * DAY_MS);
    await t.mutation(components.adminKit.aiCalls.record, { ...call, feature: "qa" });
    vi.setSystemTime(now);
    await t.mutation(components.adminKit.aiCalls.record, { ...call, feature: "voices" });

    await t.mutation(internal.aiUsage.purgeOld, {});

    const groups = await t.query(internal.aiUsage.summary, { days: 365 });
    expect(groups.map((group) => group.feature)).toEqual(["voices"]);
  });
});

describe("resultados de la IA (#235)", () => {
  it("cuenta la respuesta que cita fuera de lo recuperado y la que no encuentra pasaje", async () => {
    const t = setup();
    await seedVerse(t);
    // El modelo cita Salmos 23:4, que no se le dio: cae a la respuesta segura.
    stubProviders(200, 4);
    await t.action(internal.rag.answer.ask, { question: "¿Quién es mi pastor?" });
    await t.action(internal.rag.answer.ask, { question: "¿Quién es mi pastor?" });
    // Sin versículos: no hay pasaje que citar.
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "RV1909",
      text: "Jehová es mi pastor; nada me faltará.",
      embedding: PASTOR.map((value) => -value),
    });
    await t.action(internal.rag.answer.ask, { question: "Me siento solo", feature: "feelings" });

    const counts = await t.query(internal.aiUsage.outcomes, { days: 1 });
    expect(counts.map(({ key, count }) => [key, count]).sort()).toEqual([
      ["feelings.no_content", 1],
      ["qa.ungrounded", 2],
    ]);
  });
});

describe("frontera de convex/adminKit", () => {
  // El kit se va a mover a luiscf1226/lcf-admin (lcf-admin#2): no puede
  // depender de nada de Bible AI. Solo Convex y archivos de su carpeta.
  const sources = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/_generated/**"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("ningún archivo importa de fuera de la carpeta", () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const target = match[1];
        const allowed = target.startsWith("./") || target === "vitest" || target.startsWith("convex/");
        if (!allowed) offenders.push(`${path} → ${target}`);
      }
    }
    expect(Object.keys(sources).length).toBeGreaterThan(3);
    expect(offenders).toEqual([]);
  });
});
