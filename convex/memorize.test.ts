import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./memorize.ts": () => import("./memorize"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./devotional.ts": () => import("./devotional"),
};

/** Mediodía en Honduras (UTC-6) del día dado. */
function hn(date: string): number {
  return Date.parse(`${date}T12:00:00-06:00`);
}

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function setup() {
  const t = convexTest(schema, modules);
  const ana = asUser(t, "user_memoriza");
  await ana.mutation(api.users.upsert, {});
  await t.run(async (ctx) => {
    await ctx.db.insert("verses", {
      book: "Salmos",
      chapter: 23,
      verse: 1,
      version: "RV1909",
      text: "Jehová es mi pastor; nada me faltará.",
      embedding: Array.from({ length: 1024 }, () => 0),
    });
  });
  return { t, ana };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("memorize (#158)", () => {
  it("un versículo agregado aparece en el repaso del día siguiente, con el texto del corpus", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2026-10-02"));
    const { ana } = await setup();

    await expect(ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 })).resolves.toEqual({
      added: true,
      nextReview: "2026-10-03",
    });
    const sameDay = await ana.query(api.memorize.list, {});
    expect(sameDay.dueCount).toBe(0);
    expect(sameDay.items[0]).toMatchObject({ due: false, level: 0, text: "Jehová es mi pastor; nada me faltará." });

    vi.setSystemTime(hn("2026-10-03"));
    const nextDay = await ana.query(api.memorize.list, {});
    expect(nextDay.today).toBe("2026-10-03");
    expect(nextDay.dueCount).toBe(1);
    expect(nextDay.items[0]?.due).toBe(true);
  });

  it("acertar lo espacia y fallar lo vuelve a hoy", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2026-10-02"));
    const { ana } = await setup();
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    vi.setSystemTime(hn("2026-10-03"));
    const [item] = (await ana.query(api.memorize.list, {})).items;

    await expect(ana.mutation(api.memorize.review, { id: item!.id, correct: true })).resolves.toEqual({
      level: 1,
      nextReview: "2026-10-06",
    });
    expect((await ana.query(api.memorize.list, {})).dueCount).toBe(0);

    vi.setSystemTime(hn("2026-10-06"));
    await expect(ana.mutation(api.memorize.review, { id: item!.id, correct: false })).resolves.toEqual({
      level: 0,
      nextReview: "2026-10-06",
    });
    expect((await ana.query(api.memorize.list, {})).dueCount).toBe(1);
  });

  it("agregar dos veces no reinicia el progreso", async () => {
    const { ana } = await setup();
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    const [item] = (await ana.query(api.memorize.list, {})).items;
    await ana.mutation(api.memorize.review, { id: item!.id, correct: true });
    const again = await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    expect(again.added).toBe(false);
    const { items } = await ana.query(api.memorize.list, {});
    expect(items).toHaveLength(1);
    expect(items[0]?.level).toBe(1);
  });

  it("chapterVerses y remove", async () => {
    const { ana } = await setup();
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 4 });
    await ana.mutation(api.memorize.add, { book: "Juan", chapter: 3, verse: 16 });
    expect((await ana.query(api.memorize.chapterVerses, { book: "Salmos", chapter: 23 })).sort()).toEqual([1, 4]);

    await expect(ana.mutation(api.memorize.remove, { book: "Salmos", chapter: 23, verse: 4 })).resolves.toEqual({ removed: true });
    expect(await ana.query(api.memorize.chapterVerses, { book: "Salmos", chapter: 23 })).toEqual([1]);
  });

  it("sin el versículo en el corpus no inventa texto", async () => {
    const { ana } = await setup();
    await ana.mutation(api.memorize.add, { book: "Juan", chapter: 3, verse: 16 });
    const { items } = await ana.query(api.memorize.list, {});
    expect(items[0]?.text).toBeNull();
  });

  it("no deja repasar el versículo de otra persona", async () => {
    const { t, ana } = await setup();
    const beto = asUser(t, "user_memoriza_beto");
    await beto.mutation(api.users.upsert, {});
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    const [item] = (await ana.query(api.memorize.list, {})).items;
    await expect(beto.mutation(api.memorize.review, { id: item!.id, correct: true })).rejects.toThrow("Versículo no encontrado");
    expect((await beto.query(api.memorize.list, {})).items).toEqual([]);
  });

  it("valida la referencia y requiere sesión", async () => {
    const { t, ana } = await setup();
    await expect(ana.mutation(api.memorize.add, { book: "Salmos", chapter: 0, verse: 1 })).rejects.toThrow("inválida");
    await expect(t.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 })).rejects.toThrow("No autenticado");
    await expect(t.query(api.memorize.list, {})).resolves.toMatchObject({ dueCount: 0, items: [] });
  });
});
