import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { hondurasDateKey } from "../devotional";
import { QUOTA_LIMITS } from "../quotas";
import schema from "../schema";
import { OPENAI_EMBEDDINGS_URL, zeroEmbedding } from "./embed";
import { groundGuide } from "./groupGuide";
import { ANTHROPIC_MESSAGES_URL } from "./llm";
import { GROUP_GUIDE_SYSTEM_PROMPT, GUIDE_MAX_CONTEXT_VERSES } from "./prompts/groupGuide";
import { QA_SYSTEM_PROMPT } from "./prompts/qa";

const modules = {
  "./_generated/api.js": () => import("../_generated/api"),
  "./qa.ts": () => import("../qa"),
  "./users.ts": () => import("../users"),
  "./quotas.ts": () => import("../quotas"),
  "./entitlements.ts": () => import("../entitlements"),
  "./devotional.ts": () => import("../devotional"),
  "./devotionalCatalog.ts": () => import("../devotionalCatalog"),
  "./bibleVersions.ts": () => import("../bibleVersions"),
  "./rag/embed.ts": () => import("./embed"),
  "./rag/verses.ts": () => import("./verses"),
  "./rag/retrieve.ts": () => import("./retrieve"),
  "./rag/commentary.ts": () => import("./commentary"),
  "./rag/llm.ts": () => import("./llm"),
  "./rag/answer.ts": () => import("./answer"),
  "./rag/groupGuide.ts": () => import("./groupGuide"),
  "./rag/prompts/qa.ts": () => import("./prompts/qa"),
  "./rag/prompts/groupGuide.ts": () => import("./prompts/groupGuide"),
};

const verse = (n: number) => ({
  verseId: `verse_${n}` as Id<"verses">,
  book: "Rut",
  chapter: 1,
  verse: n,
  version: "RV1909",
  text: `texto del versículo ${n}`,
});
const ref = (n: number) => ({ book: "Rut", chapter: 1, verse: n, version: "RV1909" });
const CONTEXT = [1, 2, 3, 4, 5, 16].map(verse);

function guide(questions: Array<{ question: string; citations: ReturnType<typeof ref>[] }>, summaryCitations = [ref(1), ref(16)]) {
  return { summary: "Noemí vuelve a Belén y Rut decide quedarse con ella.", summaryCitations, questions };
}

const FIVE_QUESTIONS = [1, 2, 3, 4, 16].map((n) => ({ question: `¿Qué ven en el versículo ${n}?`, citations: [ref(n)] }));

describe("groundGuide — verificación de citas (regla dura #4)", () => {
  it("devuelve la guía con el texto real de cada cita, en orden", () => {
    const result = groundGuide(guide(FIVE_QUESTIONS, [ref(16), ref(1), ref(1)]), CONTEXT);
    expect(result?.summary.citations.map((c) => c.verse)).toEqual([1, 16]);
    expect(result?.questions).toHaveLength(5);
    expect(result?.questions[4]?.citations[0]).toMatchObject({ verse: 16, text: "texto del versículo 16", verseId: "verse_16" });
  });

  it("descarta la pregunta que cita algo fuera del contexto o no cita nada", () => {
    const questions = [
      ...FIVE_QUESTIONS.slice(0, 4),
      { question: "¿Y Juan 3:16?", citations: [{ book: "Juan", chapter: 3, verse: 16, version: "RV1909" }] },
      { question: "Sin cita", citations: [] },
    ];
    expect(groundGuide(guide(questions), CONTEXT)?.questions.map((q) => q.text)).toEqual(
      FIVE_QUESTIONS.slice(0, 4).map((q) => q.question),
    );
  });

  it("con menos de 4 preguntas verificables no entrega nada", () => {
    expect(groundGuide(guide(FIVE_QUESTIONS.slice(0, 3)), CONTEXT)).toBeNull();
  });

  it("un resumen sin cita o con una cita inventada no se entrega", () => {
    expect(groundGuide(guide(FIVE_QUESTIONS, []), CONTEXT)).toBeNull();
    expect(groundGuide(guide(FIVE_QUESTIONS, [ref(99)]), CONTEXT)).toBeNull();
  });

  it("otra versión del mismo versículo no cuenta como la misma cita", () => {
    expect(groundGuide(guide(FIVE_QUESTIONS, [{ ...ref(1), version: "RVR1960" }]), CONTEXT)).toBeNull();
  });

  it("nunca más de 5 preguntas", () => {
    const six = [...FIVE_QUESTIONS, { question: "¿Una más?", citations: [ref(5)] }];
    expect(groundGuide(guide(six), CONTEXT)?.questions).toHaveLength(5);
  });

  it("el system prompt hereda las restricciones de Preguntar", () => {
    expect(QA_SYSTEM_PROMPT).toContain("No agregues opinión teológica propia");
    expect(GROUP_GUIDE_SYSTEM_PROMPT).toContain("No agregues opinión teológica propia");
    expect(GROUP_GUIDE_SYSTEM_PROMPT).toContain("tercera persona");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function stubApis(structured: unknown) {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url === OPENAI_EMBEDDINGS_URL) return Promise.resolve(jsonResponse({ data: [{ embedding: zeroEmbedding() }] }));
    if (url === ANTHROPIC_MESSAGES_URL) {
      return Promise.resolve(jsonResponse({ content: [{ type: "text", text: JSON.stringify(structured) }] }));
    }
    throw new Error(`fetch no esperado a ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function seedRut1(t: ReturnType<typeof convexTest>, count = 6) {
  for (let n = 1; n <= count; n += 1) {
    await t.mutation(internal.rag.verses.upsertVerse, {
      book: "Rut",
      chapter: 1,
      verse: n,
      version: "RV1909",
      text: `texto del versículo ${n}`,
      embedding: zeroEmbedding(),
    });
  }
}

async function signUp(t: ReturnType<typeof convexTest>, clerkId: string, options: { pro?: boolean } = {}) {
  const user = t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
  const userId = await user.mutation(api.users.upsert, {});
  await user.mutation(api.users.acceptAiConsent, {});
  if (options.pro) {
    await t.run((ctx) =>
      ctx.db.insert("entitlements", { userId, isPro: true, source: "revenuecat_webhook", updatedAt: Date.now() }),
    );
  }
  return user;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("qa.prepareGroupGuide (#188)", () => {
  it("una cuenta gratis no llama a ningún proveedor ni descuenta cuota", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_gratis");
    const fetchMock = stubApis(guide(FIVE_QUESTIONS));

    await expect(ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 })).resolves.toEqual({ status: "pro_required" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await t.run((ctx) => ctx.db.query("usage").collect())).toEqual([]);
  });

  it("sin consentimiento de IA no hace nada", async () => {
    const t = convexTest(schema, modules);
    const user = t.withIdentity({ subject: "guia_sin_consentimiento", issuer: "https://example-dev.clerk.accounts.dev" });
    await user.mutation(api.users.upsert, {});
    const fetchMock = stubApis(guide(FIVE_QUESTIONS));
    await expect(user.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 })).rejects.toThrow("AI_CONSENT_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Pro: arma la guía con el capítulo como contexto y cada pieza citada", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_pro", { pro: true });
    await seedRut1(t, 16);
    const fetchMock = stubApis(guide(FIVE_QUESTIONS));

    const result = await ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("esperado ok");
    expect(result.guide).toMatchObject({ book: "Rut", chapter: 1, version: "RV1909", truncatedAtVerse: null });
    expect(result.guide.questions).toHaveLength(5);
    expect(result.guide.questions.every((q) => q.citations.length > 0)).toBe(true);

    const anthropicCall = fetchMock.mock.calls.find(([url]) => url === ANTHROPIC_MESSAGES_URL);
    const body = JSON.parse(String((anthropicCall?.[1] as RequestInit).body));
    expect(body.system).toBe(GROUP_GUIDE_SYSTEM_PROMPT);
    expect(body.messages[0].content).toContain("Rut 1:16 (RV1909)");
    expect(body.messages[0].content).toContain("Prepará la guía de conversación para el grupo sobre Rut 1.");
  });

  it("pasa por la cuota de Preguntar: Pro sin tope, igual que en Preguntar", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_cuota", { pro: true });
    await seedRut1(t, 16);
    stubApis(guide(FIVE_QUESTIONS));
    // Con el contador de qa de hoy ya en el tope gratis, Pro sigue pudiendo:
    // mismo `quotas.checkAndConsume({ module: "qa" })` que `qa.ask`.
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").first();
      await ctx.db.insert("usage", { userId: user!._id, module: "qa", day: hondurasDateKey(), count: QUOTA_LIMITS.qa });
    });
    for (let i = 0; i <= QUOTA_LIMITS.qa; i += 1) {
      expect((await ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 })).status).toBe("ok");
    }
  });

  it("un Pro vencido vuelve a ver el aviso de Pro, sin llamar a nadie", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_vencida", { pro: true });
    await seedRut1(t);
    await t.run(async (ctx) => {
      const row = await ctx.db.query("entitlements").first();
      await ctx.db.patch(row!._id, { isPro: false });
    });
    const fetchMock = stubApis(guide(FIVE_QUESTIONS));
    await expect(ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 })).resolves.toEqual({ status: "pro_required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("capítulo sin versículos indexados: no inventa", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_vacia", { pro: true });
    const fetchMock = stubApis(guide(FIVE_QUESTIONS));
    await expect(ana.action(api.qa.prepareGroupGuide, { book: "Abdías", chapter: 1 })).resolves.toEqual({ status: "no_content" });
    expect(fetchMock.mock.calls.some(([url]) => url === ANTHROPIC_MESSAGES_URL)).toBe(false);
  });

  it("si el modelo cita fuera del capítulo, no se entrega la guía", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_inventada", { pro: true });
    await seedRut1(t, 16);
    stubApis(guide(FIVE_QUESTIONS.map((q) => ({ ...q, citations: [{ book: "Juan", chapter: 3, verse: 16, version: "RV1909" }] }))));
    await expect(ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 })).resolves.toEqual({ status: "not_grounded" });
  });

  it("un capítulo largo viaja recortado y la guía lo avisa", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "guia_larga", { pro: true });
    await seedRut1(t, GUIDE_MAX_CONTEXT_VERSES + 3);
    stubApis(guide(FIVE_QUESTIONS));
    const result = await ana.action(api.qa.prepareGroupGuide, { book: "Rut", chapter: 1 });
    expect(result.status === "ok" && result.guide.truncatedAtVerse).toBe(GUIDE_MAX_CONTEXT_VERSES);
  });
});
