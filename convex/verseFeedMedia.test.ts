import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import adminKitSchema from "./adminKit/schema";
import schema from "./schema";
import { estimateSpeechTokens } from "./speech";
import { FEED_POOL } from "./verseFeedCore";
import { FEED_SCENES, feedImagePrompt, MAX_ATTEMPTS } from "./verseFeedMedia";
import { spokenText, textHash } from "./verseFeedText";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./verseFeedMedia.ts": () => import("./verseFeedMedia"),
  "./verseFeed.ts": () => import("./verseFeed"),
  "./aiUsage.ts": () => import("./aiUsage"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};
const adminKitModules = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/**/*.test.ts"]);

/** Un catálogo chico: solo los primeros pasajes tienen texto cargado. */
const SEEDED = FEED_POOL.slice(0, 3);

function setup() {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  t.registerComponent("adminKit", adminKitSchema, adminKitModules);
  return t;
}

async function seedVerses(t: ReturnType<typeof convexTest>, passages = SEEDED) {
  await t.run(async (ctx) => {
    for (const passage of passages) {
      for (let verse = passage.verse; verse <= (passage.endVerse ?? passage.verse); verse += 1) {
        await ctx.db.insert("verses", {
          version: "RV1909",
          book: passage.book,
          chapter: passage.chapter,
          verse,
          text: verse === passage.verse ? "ES pues la fe" : "y la esperanza",
          embedding: [],
        });
      }
    }
  });
}

/** OpenAI de mentira: imágenes en base64 y audio en bytes. Guarda cada pedido. */
function stubOpenAI(options: { failImages?: number; outOfCredit?: boolean } = {}) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      requests.push({ url, body });
      if (url.endsWith("/images/generations")) {
        if (options.outOfCredit) {
          return new Response(
            JSON.stringify({ error: { type: "insufficient_quota", code: "credit_balance_exhausted" } }),
            { status: 429 },
          );
        }
        if (options.failImages) return new Response("boom", { status: options.failImages });
        return new Response(
          JSON.stringify({ data: [{ b64_json: btoa("webp") }], usage: { input_tokens: 10, output_tokens: 20 } }),
          {
            status: 200,
          },
        );
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }),
  );
  return requests;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("prompt del fondo", () => {
  it("lleva el pasaje y las reglas: sin texto en la imagen y nunca Jesús, Dios ni el Espíritu Santo como figura", () => {
    const prompt = feedImagePrompt({ ref: "Juan 14:27", topics: ["paz"] }, "La paz os dejo");
    expect(prompt).toContain('Juan 14:27, Reina-Valera 1909): "La paz os dejo"');
    expect(prompt).toContain("Theme: Paz.");
    expect(prompt).toContain("Never depict Jesus, God or the Holy Spirit");
    expect(prompt).toContain("No written text");
  });

  it("cada cita trae siempre la misma escena sugerida, y el catálogo usa varias", () => {
    const sceneOf = (ref: string) =>
      FEED_SCENES.find((scene) => feedImagePrompt({ ref, topics: [] }, "x").includes(scene));
    expect(sceneOf("Juan 14:27")).toBe(sceneOf("Juan 14:27"));
    const used = new Set(FEED_POOL.map((passage) => sceneOf(passage.ref)));
    expect(used.size).toBe(FEED_SCENES.length);
  });
});

describe("generateMissing", () => {
  it("genera imagen y voz de cada cita con texto, con el texto que muestra el feed", async () => {
    const t = setup();
    await seedVerses(t);
    const requests = stubOpenAI();

    await t.action(internal.verseFeedMedia.generateMissing, { budget: 6, parallel: 1 });

    const rows = await t.run((ctx) => ctx.db.query("verseFeedMedia").collect());
    expect(rows.filter((row) => row.kind === "image" && row.storageId)).toHaveLength(3);
    expect(rows.filter((row) => row.kind === "audio" && row.version === "RV1909" && row.storageId)).toHaveLength(3);

    const image = requests.find((request) => request.url.endsWith("/images/generations"))!;
    expect(image.body).toMatchObject({ size: "1024x1536", output_format: "webp", quality: "medium" });
    const speech = requests.find((request) => request.url.endsWith("/audio/speech"))!;
    // La voz lee lo mismo que se ve: primera palabra de RV1909 sin el "ES" en mayúsculas.
    expect(String(speech.body.input)).toMatch(/^Es pues la fe/);
    expect(speech.body).toMatchObject({ model: "gpt-4o-mini-tts", response_format: "mp3" });
  });

  it("nunca pasa del presupuesto", async () => {
    const t = setup();
    await seedVerses(t);
    const requests = stubOpenAI();

    await t.action(internal.verseFeedMedia.generateMissing, { budget: 2, parallel: 1 });

    expect(requests).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("verseFeedMedia").collect())).toHaveLength(2);
  });

  it("una falla de la cita cuenta como intento y deja de reintentar después del tope", async () => {
    const t = setup();
    await seedVerses(t);
    stubOpenAI({ failImages: 400 });

    for (let round = 0; round < MAX_ATTEMPTS + 1; round += 1) {
      await t.action(internal.verseFeedMedia.generateMissing, { budget: 6, parallel: 1 });
    }

    const images = await t.run(async (ctx) =>
      (await ctx.db.query("verseFeedMedia").collect()).filter((row) => row.kind === "image"),
    );
    expect(images).toHaveLength(3);
    expect(images.every((row) => !row.storageId && row.attempts === MAX_ATTEMPTS && !row.inProgressUntil)).toBe(true);
    expect(await t.query(internal.verseFeedMedia.progress, {})).toMatchObject({ images: 0, audio: 3, gaveUp: 3 });

    // Arreglada la causa, se les vuelve a dar intentos.
    expect(await t.mutation(internal.verseFeedMedia.resetGaveUp, {})).toEqual({ reset: 3 });
  });

  it("una caída o un límite del proveedor no gasta intentos", async () => {
    const t = setup();
    await seedVerses(t);
    stubOpenAI({ failImages: 429 });

    for (let round = 0; round < MAX_ATTEMPTS + 1; round += 1) {
      await t.action(internal.verseFeedMedia.generateMissing, { budget: 6, parallel: 1 });
    }

    const images = await t.run(async (ctx) =>
      (await ctx.db.query("verseFeedMedia").collect()).filter((row) => row.kind === "image"),
    );
    expect(images.every((row) => row.attempts === 0 && !row.inProgressUntil)).toBe(true);
  });

  it("un éxito vuelve los intentos a cero: una voz vieja con fallas previas se puede regenerar", async () => {
    const t = setup();
    await seedVerses(t);
    stubOpenAI();
    // Dos fallas antes del éxito.
    await t.run(async (ctx) => {
      await ctx.db.insert("verseFeedMedia", {
        ref: SEEDED[0].ref,
        kind: "audio",
        version: "RV1909",
        attempts: MAX_ATTEMPTS - 1,
        updatedAt: 0,
      });
    });
    await t.action(internal.verseFeedMedia.generateMissing, { budget: 6, parallel: 1 });
    const audio = await t.run(async (ctx) =>
      (await ctx.db.query("verseFeedMedia").collect()).find(
        (row) => row.kind === "audio" && row.ref === SEEDED[0].ref,
      )!,
    );
    expect(audio).toMatchObject({ attempts: 0 });
    expect(audio.storageId).toBeDefined();
  });

  it("sin saldo en OpenAI la cadena se detiene y no gasta intentos", async () => {
    const t = setup();
    // Más de una tanda de trabajo: sin el freno, quedaría otra tanda agendada.
    await seedVerses(t, FEED_POOL.slice(0, 6));
    stubOpenAI({ outOfCredit: true });

    const result = await t.action(internal.verseFeedMedia.generateMissing, { budget: 100, parallel: 1 });

    expect(result.remaining).toBeGreaterThan(0);
    expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
    const images = await t.run(async (ctx) =>
      (await ctx.db.query("verseFeedMedia").collect()).filter((row) => row.kind === "image"),
    );
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((row) => row.attempts === 0)).toBe(true);
  });

  it("dos tandas a la vez nunca reservan la misma cita", async () => {
    const t = setup();
    await seedVerses(t);
    const first = await t.mutation(internal.verseFeedMedia.claim, { limit: 4 });
    const second = await t.mutation(internal.verseFeedMedia.claim, { limit: 4 });
    const key = (item: { ref: string; kind: string }) => `${item.kind}:${item.ref}`;
    expect(first).toHaveLength(4);
    expect(second).toHaveLength(2);
    expect(second.some((item) => first.map(key).includes(key(item)))).toBe(false);
  });

  it("una voz que leyó otro texto se vuelve a generar", async () => {
    const t = setup();
    await seedVerses(t);
    stubOpenAI();
    await t.action(internal.verseFeedMedia.generateMissing, { budget: 6, parallel: 1 });
    expect(await t.mutation(internal.verseFeedMedia.claim, { limit: 6 })).toHaveLength(0);

    // Cambia el texto de la primera cita (otra Biblia cargada, por ejemplo).
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("verses").collect()).find(
        (verse) => verse.book === SEEDED[0].book && verse.verse === SEEDED[0].verse,
      )!;
      await ctx.db.patch(row._id, { text: "Otro texto" });
    });

    const again = await t.mutation(internal.verseFeedMedia.claim, { limit: 6 });
    expect(again).toMatchObject([{ ref: SEEDED[0].ref, kind: "audio" }]);
    expect(again[0].text).toMatch(/^Otro texto/);
  });
});

describe("el feed usa los medios guardados", () => {
  it("con fondo y voz generados, la página trae sus URLs; sin ellos, la foto de siempre y sin voz", async () => {
    const t = setup();
    // Todo el catálogo con texto, como en producción.
    await t.run(async (ctx) => {
      const inserted = new Set<string>();
      for (const passage of FEED_POOL) {
        for (let verse = passage.verse; verse <= (passage.endVerse ?? passage.verse); verse += 1) {
          const key = `${passage.book} ${passage.chapter}:${verse}`;
          if (inserted.has(key)) continue;
          inserted.add(key);
          await ctx.db.insert("verses", {
            version: "RV1909",
            book: passage.book,
            chapter: passage.chapter,
            verse,
            text: "texto",
            embedding: [],
          });
        }
      }
    });
    const before = await t.query(api.verseFeed.page, { seen: [], seed: 1 });
    const [first, second] = before.items;
    expect(first.audioUrl).toBeNull();
    await t.run(async (ctx) => {
      const image = await ctx.storage.store(new Blob(["img"], { type: "image/webp" }));
      const audio = await ctx.storage.store(new Blob(["mp3"], { type: "audio/mpeg" }));
      await ctx.db.insert("verseFeedMedia", {
        ref: first.ref,
        kind: "image",
        version: "",
        storageId: image,
        attempts: 1,
        updatedAt: 0,
      });
      await ctx.db.insert("verseFeedMedia", {
        ref: first.ref,
        kind: "audio",
        version: "RV1909",
        storageId: audio,
        textHash: textHash(spokenText(first.text)),
        attempts: 1,
        updatedAt: 0,
      });
      // La segunda cita tiene una voz de otro texto: no se usa.
      await ctx.db.insert("verseFeedMedia", {
        ref: second.ref,
        kind: "audio",
        version: "RV1909",
        storageId: audio,
        textHash: textHash("otra cosa"),
        attempts: 1,
        updatedAt: 0,
      });
    });

    // Misma semilla y mismo visto: mismo orden, ahora con los medios de la primera cita.
    const after = await t.query(api.verseFeed.page, { seen: [], seed: 1 });
    expect(after.items[0].ref).toBe(first.ref);
    expect(after.items[0].imageUrl).not.toBe(first.imageUrl);
    expect(after.items[0].audioUrl).toMatch(/^https?:\/\//);
    const shown =
      first.endVerse === null
        ? `${first.book} ${first.chapter}:${first.verse}`
        : `${first.book} ${first.chapter}:${first.verse}-${first.endVerse}`;
    expect(after.items[0].imageAlt).toBe(`Ilustración inspirada en ${shown}`);
    expect(after.items[1]).toMatchObject({ ref: second.ref, imageUrl: second.imageUrl, audioUrl: null });
  });
});

describe("costo estimado de la voz", () => {
  it("crece con el largo del texto", () => {
    const short = estimateSpeechTokens("a".repeat(100));
    const long = estimateSpeechTokens("a".repeat(300));
    expect(long.outputTokens).toBeGreaterThan(short.outputTokens);
    expect(long.inputTokens - short.inputTokens).toBe(50);
  });
});
