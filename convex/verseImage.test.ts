import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import adminKitSchema from "./adminKit/schema";
import { QUOTA_LIMITS } from "./quotas";
import schema from "./schema";
import { FEED_POOL } from "./verseFeedCore";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./verseImage.ts": () => import("./verseImage"),
  "./verseFeedMedia.ts": () => import("./verseFeedMedia"),
  "./quotas.ts": () => import("./quotas"),
  "./aiUsage.ts": () => import("./aiUsage"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};
const adminKitModules = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/**/*.test.ts"]);

// Un versículo fuera del catálogo del feed y un rango del catálogo.
const LOOSE = { book: "Números", chapter: 6, verse: 24 };
const RANGE = FEED_POOL.find((passage) => passage.endVerse !== null)!;

function setup() {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  t.registerComponent("adminKit", adminKitSchema, adminKitModules);
  return t;
}

async function signIn(t: ReturnType<typeof convexTest>, clerkId = "user_img") {
  const authed = t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
  await authed.mutation(api.users.upsert, {});
  return authed;
}

async function seedVerses(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    const rows = [
      { ...LOOSE, text: "Jehová te bendiga, y te guarde:" },
      { ...LOOSE, verse: 25, text: "Haga resplandecer Jehová su rostro sobre ti," },
      { ...LOOSE, verse: 26, text: "Jehová alce á ti su rostro, y ponga en ti paz." },
      ...Array.from({ length: (RANGE.endVerse ?? RANGE.verse) - RANGE.verse + 1 }, (_, index) => ({
        book: RANGE.book,
        chapter: RANGE.chapter,
        verse: RANGE.verse + index,
        text: index === 0 ? "ES pues la fe" : "y la esperanza",
      })),
    ];
    for (const row of rows) {
      await ctx.db.insert("verses", { version: "RV1909", embedding: [], ...row });
    }
  });
}

/** OpenAI de mentira: guarda cada prompt y responde con una imagen o con el error pedido. */
function stubOpenAI(options: { status?: number; outOfCredit?: boolean } = {}) {
  const prompts: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      prompts.push(String((JSON.parse(String(init.body)) as { prompt: string }).prompt));
      if (options.outOfCredit) {
        return new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), { status: 429 });
      }
      if (options.status) return new Response("boom", { status: options.status });
      return new Response(JSON.stringify({ data: [{ b64_json: btoa("webp") }], usage: {} }), { status: 200 });
    }),
  );
  return prompts;
}

async function imageRows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => (await ctx.db.query("verseFeedMedia").collect()).filter((row) => row.kind === "image"));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("verseImage.compose", () => {
  it("trae el texto del corpus, el rango entero y las fotos del catálogo", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    const result = await authed.query(api.verseImage.compose, { ...LOOSE, verseEnd: 26 });
    expect(result.version).toBe("RV1909");
    expect(result.text).toBe(
      "Jehová te bendiga, y te guarde: Haga resplandecer Jehová su rostro sobre ti, Jehová alce á ti su rostro, y ponga en ti paz.",
    );
    expect(result.endVerse).toBe(26);
    expect(result.aiImageUrl).toBeNull();
    expect(result.photos.length).toBeGreaterThan(3);
  });

  it("un rango con versículos que faltan se corta en el último seguido; sin texto, null", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    const short = await authed.query(api.verseImage.compose, { ...LOOSE, verseEnd: 30 });
    expect(short.endVerse).toBe(26);
    const missing = await authed.query(api.verseImage.compose, { book: "Juan", chapter: 3, verse: 16 });
    expect(missing.text).toBeNull();
  });

  it("baja la mayúscula de la primera palabra del capítulo, como el feed", async () => {
    const t = setup();
    await seedVerses(t);
    const result = await t.query(api.verseImage.compose, { book: RANGE.book, chapter: RANGE.chapter, verse: RANGE.verse });
    expect(result.version).toBe("RV1909");
    expect(result.text).toBe("Es pues la fe");
  });

  it("usa el fondo de IA de la cita del feed que contiene al versículo", async () => {
    const t = setup();
    await seedVerses(t);
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["img"], { type: "image/webp" }));
      await ctx.db.insert("verseFeedMedia", { ref: RANGE.ref, kind: "image", version: "", storageId, attempts: 0, updatedAt: 0 });
    });
    const result = await t.query(api.verseImage.compose, { book: RANGE.book, chapter: RANGE.chapter, verse: RANGE.verse });
    expect(result.aiImageUrl).toEqual(expect.any(String));
  });
});

describe("verseImage.generateBackground", () => {
  it("genera con el prompt del feed, lo guarda con la cita como llave y descuenta una cuota", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    const prompts = stubOpenAI();

    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({ status: "ready" });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('(Números 6:24, Reina-Valera 1909): "Jehová te bendiga, y te guarde:"');
    expect(prompts[0]).toContain("Never depict Jesus, God or the Holy Spirit");
    const [row] = await imageRows(t);
    expect(row.ref).toBe("Números 6:24");
    expect(row.storageId).toBeDefined();
    expect(row.inProgressUntil).toBeUndefined();
    expect((await authed.query(api.quotas.remaining, { module: "verseImage" })).remaining).toBe(QUOTA_LIMITS.verseImage - 1);
    expect((await authed.query(api.verseImage.compose, LOOSE)).aiImageUrl).toEqual(expect.any(String));
  });

  it("si la cita ya tiene fondo no llama a OpenAI ni cobra", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    const prompts = stubOpenAI();
    await authed.action(api.verseImage.generateBackground, LOOSE);
    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({ status: "ready" });
    expect(prompts).toHaveLength(1);
    expect((await authed.query(api.quotas.remaining, { module: "verseImage" })).remaining).toBe(QUOTA_LIMITS.verseImage - 1);
  });

  it("con la cuota del día agotada responde limit_reached sin llamar a OpenAI", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    const prompts = stubOpenAI();
    for (let verse = 1; verse <= QUOTA_LIMITS.verseImage; verse += 1) {
      await t.run(async (ctx) => {
        await ctx.db.insert("verses", { version: "RV1909", book: "Salmos", chapter: 121, verse, text: `v${verse}`, embedding: [] });
      });
      await authed.action(api.verseImage.generateBackground, { book: "Salmos", chapter: 121, verse });
    }
    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({ status: "limit_reached" });
    expect(prompts).toHaveLength(QUOTA_LIMITS.verseImage);
    expect(await imageRows(t)).toHaveLength(QUOTA_LIMITS.verseImage);
  });

  it("si OpenAI está sin saldo devuelve no_credit, libera la reserva y devuelve la cuota", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    stubOpenAI({ outOfCredit: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({
      status: "failed",
      reason: "no_credit",
    });
    const [row] = await imageRows(t);
    expect(row.storageId).toBeUndefined();
    expect(row.inProgressUntil).toBeUndefined();
    expect(row.attempts).toBe(0);
    expect((await authed.query(api.quotas.remaining, { module: "verseImage" })).remaining).toBe(QUOTA_LIMITS.verseImage);
  });

  it("una caída del proveedor es provider; una reserva vigente de otro pedido es busy", async () => {
    const t = setup();
    await seedVerses(t);
    const authed = await signIn(t);
    stubOpenAI({ status: 500 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({
      status: "failed",
      reason: "provider",
    });

    await t.run(async (ctx) => {
      const [row] = (await ctx.db.query("verseFeedMedia").collect()).filter((item) => item.ref === "Números 6:24");
      await ctx.db.patch(row._id, { inProgressUntil: Date.now() + 60_000 });
    });
    await expect(authed.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({ status: "busy" });
    expect((await authed.query(api.quotas.remaining, { module: "verseImage" })).remaining).toBe(QUOTA_LIMITS.verseImage);
  });

  it("sin sesión o sin texto cargado es unavailable", async () => {
    const t = setup();
    await seedVerses(t);
    stubOpenAI();
    await expect(t.action(api.verseImage.generateBackground, LOOSE)).resolves.toEqual({ status: "unavailable" });
    const authed = await signIn(t);
    await expect(authed.action(api.verseImage.generateBackground, { book: "Juan", chapter: 3, verse: 16 })).resolves.toEqual({
      status: "unavailable",
    });
  });
});
