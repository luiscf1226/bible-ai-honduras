import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./yearInWord.ts": () => import("./yearInWord"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./devotional.ts": () => import("./devotional"),
};

/** Mediodía en Honduras (UTC-6) del día dado. */
function hn(date: string, hour = "12:00"): number {
  return Date.parse(`${date}T${hour}:00-06:00`);
}

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function seed(t: TestConvex<typeof schema>, clerkId: string) {
  const user = asUser(t, clerkId);
  await user.mutation(api.users.upsert, {});
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    const userId = row!._id;
    // Tres capítulos en 2026 (uno el 31 dic a las 23:30 de Honduras, que en
    // UTC ya es 2027) y uno en 2025.
    for (const [book, chapter, openedAt] of [
      ["Juan", 3, hn("2026-02-10")],
      ["Juan", 4, hn("2026-07-01")],
      ["Salmos", 46, hn("2026-12-31", "23:30")],
      ["Génesis", 1, hn("2025-12-30")],
    ] as const) {
      await ctx.db.insert("readingRecents", { userId, book, chapter, openedAt });
    }
    // Plan anual desde el 30 dic 2025: los días 1 y 2 son de 2025; 3, 4 y 10, de 2026.
    await ctx.db.insert("userPlanProgress", {
      userId,
      planId: "canonico",
      startedAt: "2025-12-30",
      completedDays: [1, 2, 3, 4, 10],
      currentStreak: 0,
      longestStreak: 3,
    });
    // Un recorrido entero en 2026.
    await ctx.db.insert("userPlanProgress", {
      userId,
      planId: "recorrido",
      startedAt: "2026-05-01",
      completedDays: [1, 2],
      currentStreak: 0,
      longestStreak: 2,
    });
    await ctx.db.insert("readingBookmarks", { userId, book: "Juan", chapter: 3, verse: 16, createdAt: hn("2026-03-01"), note: "privada" });
    await ctx.db.insert("readingBookmarks", { userId, book: "Rut", chapter: 1, verse: 16, createdAt: hn("2026-08-01") });
    await ctx.db.insert("readingBookmarks", { userId, book: "Rut", chapter: 1, verse: 17, createdAt: hn("2025-08-01") });
    for (const verse of [10, 1, 2]) {
      await ctx.db.insert("readingHighlights", { userId, book: "Salmos", chapter: 46, verse, color: "amber", updatedAt: hn("2026-04-01") });
    }
    await ctx.db.insert("readingHighlights", { userId, book: "Juan", chapter: 3, verse: 16, color: "sage", updatedAt: hn("2026-09-01") });
    await ctx.db.insert("verses", {
      book: "Salmos",
      chapter: 46,
      verse: 1,
      version: "RV1909",
      text: "Dios es nuestro amparo y fortaleza,",
      embedding: [],
    });
  });
  return user;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("yearInWord.summary (#183)", () => {
  it("agrega capítulos, días de plan, guardados y el más subrayado del año", async () => {
    const t = convexTest(schema, modules);
    const ana = await seed(t, "year_ana");

    const summary = await ana.query(api.yearInWord.summary, { year: 2026 });
    expect(summary).toEqual({
      year: 2026,
      chaptersRead: 3,
      planDays: 5,
      savedVerses: 2,
      topHighlight: {
        book: "Salmos",
        chapter: 46,
        verse: 1,
        chapterCount: 3,
        version: "RV1909",
        text: "Dios es nuestro amparo y fortaleza,",
      },
    });
    // Nada de notas en el resumen.
    expect(JSON.stringify(summary)).not.toContain("privada");
  });

  it("otro año cuenta lo suyo; sin el versículo en el corpus, el texto es null", async () => {
    const t = convexTest(schema, modules);
    const ana = await seed(t, "year_prev");
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "year_prev"))
        .unique();
      await ctx.db.insert("readingHighlights", { userId: user!._id, book: "Rut", chapter: 1, verse: 16, color: "clay", updatedAt: hn("2025-08-01") });
    });

    await expect(ana.query(api.yearInWord.summary, { year: 2025 })).resolves.toEqual({
      year: 2025,
      chaptersRead: 1,
      planDays: 2,
      savedVerses: 1,
      topHighlight: { book: "Rut", chapter: 1, verse: 16, chapterCount: 1, version: "RV1909", text: null },
    });
  });

  it("sin año, en enero resume el año que terminó", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(hn("2027-01-15"));
    const t = convexTest(schema, modules);
    const ana = await seed(t, "year_jan");
    await expect(ana.query(api.yearInWord.summary, {})).resolves.toMatchObject({ year: 2026, chaptersRead: 3 });

    vi.setSystemTime(hn("2026-12-05"));
    await expect(ana.query(api.yearInWord.summary, {})).resolves.toMatchObject({ year: 2026 });
  });

  it("no mezcla personas, no responde sin sesión y rechaza años absurdos", async () => {
    const t = convexTest(schema, modules);
    await seed(t, "year_owner");
    const beto = asUser(t, "year_beto");
    await beto.mutation(api.users.upsert, {});

    await expect(beto.query(api.yearInWord.summary, { year: 2026 })).resolves.toEqual({
      year: 2026,
      chaptersRead: 0,
      planDays: 0,
      savedVerses: 0,
      topHighlight: null,
    });
    await expect(t.query(api.yearInWord.summary, { year: 2026 })).resolves.toBeNull();
    await expect(beto.query(api.yearInWord.summary, { year: 1900 })).rejects.toThrow("year fuera de rango");
  });
});
