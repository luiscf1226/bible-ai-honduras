import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "./_generated/api";
import { MANIFEST, hondurasDayWindow, streakBucket } from "./adminAdapter";
import adminKitSchema from "./adminKit/schema";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./adminAdapter.ts": () => import("./adminAdapter"),
  "./users.ts": () => import("./users"),
  "./entitlements.ts": () => import("./entitlements"),
  "./http.ts": () => import("./http"),
};
const adminKitModules = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/**/*.test.ts"]);

const TOKEN = "token-de-prueba-largo";
const DAY = "2026-10-01";
// Mediodía en Honduras (UTC-6).
const NOON = Date.parse("2026-10-01T18:00:00Z");
const HOUR = 3_600_000;

type KitDb = { db: { insert: (table: string, row: Record<string, unknown>) => Promise<unknown> } };

function setup() {
  vi.stubEnv("ADMIN_API_TOKEN", TOKEN);
  const t = convexTest(schema, modules);
  t.registerComponent("adminKit", adminKitSchema, adminKitModules);
  return t;
}

// `runInComponent` existe en convex-test pero sus tipos todavía no lo exponen.
function kit<T>(t: ReturnType<typeof setup>, fn: (ctx: KitDb) => Promise<T>): Promise<T> {
  const runner = t as unknown as { runInComponent: (path: string, fn: (ctx: KitDb) => Promise<T>) => Promise<T> };
  return runner.runInComponent("adminKit", fn);
}

function get(path: string, t: ReturnType<typeof setup>) {
  return t.fetch(path, { headers: { authorization: `Bearer ${TOKEN}` } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function seed(t: ReturnType<typeof setup>) {
  // Ayer: una persona que ya existía, con Pro vigente.
  vi.setSystemTime(NOON - 24 * HOUR);
  const ana = await t.run((ctx) =>
    ctx.db.insert("users", { clerkId: "ana", bibleVersion: "RV1909", referralCode: "ANA1", onboardedAt: 1, aiConsentAt: 1 }),
  );
  await t.run((ctx) => ctx.db.insert("entitlements", { userId: ana, isPro: true, source: "revenuecat_webhook", updatedAt: 1 }));
  // Hoy: una persona nueva que llegó por invitación.
  vi.setSystemTime(NOON);
  const beto = await t.run((ctx) =>
    ctx.db.insert("users", { clerkId: "beto", bibleVersion: "RVR1960", referralCode: "BETO", referredBy: "ANA1", referredVia: "link" }),
  );
  await t.run(async (ctx) => {
    await ctx.db.insert("usage", { userId: ana, module: "qa", day: DAY, count: 3 });
    await ctx.db.insert("usage", { userId: beto, module: "voices", day: DAY, count: 2 });
    await ctx.db.insert("usage", { userId: beto, module: "qa", day: "2026-09-30", count: 9 });
    await ctx.db.insert("readingRecents", { userId: ana, book: "Juan", chapter: 3, openedAt: NOON });
    await ctx.db.insert("readingRecents", { userId: beto, book: "Juan", chapter: 1, openedAt: NOON });
    await ctx.db.insert("readingRecents", { userId: beto, book: "Salmos", chapter: 23, openedAt: NOON - 30 * HOUR });
    await ctx.db.insert("readingHighlights", { userId: ana, book: "Juan", chapter: 3, verse: 16, color: "amber", updatedAt: NOON });
    await ctx.db.insert("userPlanProgress", {
      userId: ana,
      planId: "canonico",
      startedAt: "2026-09-01",
      completedDays: [1, 2, 3],
      currentStreak: 8,
      longestStreak: 8,
      lastActivityAt: NOON,
    });
  });
  await kit(t, async (ctx) => {
    await ctx.db.insert("events", { installId: "tel-aaaa", name: "app_opened", platform: "ios", at: NOON });
    await ctx.db.insert("events", { installId: "tel-bbbb", name: "app_opened", platform: "android", at: NOON - 3 * 24 * HOUR });
    await ctx.db.insert("aiCalls", {
      feature: "qa",
      provider: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 1_000,
      outputTokens: 200,
      costUsd: 0.004,
      latencyMs: 900,
      ok: true,
      at: NOON,
    });
    await ctx.db.insert("counters", { day: DAY, key: "voices.refused", count: 2 });
  });
}

describe("adminAdapter (#235)", () => {
  it("el día de Honduras va de 06:00 a 06:00 UTC", () => {
    expect(hondurasDayWindow(DAY)).toEqual({
      startMs: Date.parse("2026-10-01T06:00:00Z"),
      endMs: Date.parse("2026-10-02T06:00:00Z"),
    });
  });

  it("rachas por tramos", () => {
    expect([0, 1, 6, 7, 29, 30].map(streakBucket)).toEqual(["0", "1-6", "1-6", "7-29", "7-29", "30+"]);
  });

  it("cada métrica de las secciones del manifiesto está descrita", () => {
    const listed = [...MANIFEST.sections.flatMap((section) => section.metrics), ...(MANIFEST.highlights ?? [])];
    expect(listed.filter((key) => !(key in MANIFEST.metrics))).toEqual([]);
  });

  it("la foto del día junta estándar y Bible AI, y se sirve por /admin/metrics", async () => {
    vi.useFakeTimers();
    const t = setup();
    await seed(t);

    await t.mutation(internal.adminAdapter.rollupDay, { day: DAY });
    // Recalcular no duplica filas.
    await t.mutation(internal.adminAdapter.rollupDay, { day: DAY });

    const response = await get(`/admin/metrics?from=${DAY}&to=${DAY}`, t);
    expect(response.status).toBe(200);
    const { rows } = (await response.json()) as { rows: Array<{ key: string; dim?: string; value: number }> };
    const value = (key: string, dim?: string) => {
      const matches = rows.filter((row) => row.key === key && row.dim === dim);
      expect(matches.length).toBeLessThanOrEqual(1);
      return matches[0]?.value;
    };

    expect(value("users.total")).toBe(2);
    expect(value("users.new")).toBe(1);
    expect(value("users.onboarded")).toBe(1);
    expect(value("users.referred_new", "link")).toBe(1);
    expect(value("users.by_version", "RVR1960")).toBe(1);
    expect(value("pro.active")).toBe(1);
    expect(value("pro.conversion")).toBe(50);
    expect(value("quota.usage")).toBe(5);
    expect(value("quota.usage", "qa")).toBe(3);
    expect(value("bible.chapters_opened", "Juan")).toBe(2);
    expect(value("bible.chapters_opened", "Salmos")).toBeUndefined();
    expect(value("bible.highlights_new")).toBe(1);
    expect(value("plans.active_7d", "canonico")).toBe(1);
    expect(value("plans.streaks", "7-29")).toBe(1);
    expect(value("std.active_1d")).toBe(1);
    expect(value("std.active_7d")).toBe(2);
    expect(value("std.ai_cost_usd", "qa")).toBeCloseTo(0.004);
    expect(value("std.ai_outcomes", "voices.refused")).toBe(2);

    // Toda métrica que produce el rollup está en el manifiesto.
    expect([...new Set(rows.map((row) => row.key))].filter((key) => !(key in MANIFEST.metrics))).toEqual([]);
  });

  it("/admin/manifest pide token y devuelve el de Bible AI", async () => {
    const t = setup();
    expect((await t.fetch("/admin/manifest")).status).toBe(401);
    const response = await get("/admin/manifest", t);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ contractVersion: 1, app: { id: "bible-ai-honduras" } });
  });

  it("/admin/users lista cuentas con Pro y uso de IA, busca y pagina", async () => {
    vi.useFakeTimers();
    const t = setup();
    await seed(t);
    // Una tercera cuenta, la más nueva.
    vi.setSystemTime(NOON + HOUR);
    await t.run((ctx) => ctx.db.insert("users", { clerkId: "caro", email: "caro@ejemplo.hn", name: "Caro", bibleVersion: "NVI", referralCode: "CARO" }));
    await t.run(async (ctx) => {
      const ana = await ctx.db.query("users").withIndex("by_clerk_id", (q) => q.eq("clerkId", "ana")).unique();
      await ctx.db.patch(ana!._id, { email: "ana@ejemplo.hn", name: "Ana" });
      await ctx.db.insert("usage", { userId: ana!._id, module: "stories", day: "lifetime", count: 1 });
    });

    const first = await (await get("/admin/users?limit=2", t)).json();
    expect(first.users.map((user: { name?: string }) => user.name)).toEqual(["Caro", undefined]);
    expect(first.nextCursor).toBeDefined();
    const second = await (await get(`/admin/users?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`, t)).json();
    expect(second.users).toHaveLength(1);
    expect(second.users[0]).toMatchObject({
      email: "ana@ejemplo.hn",
      isPro: true,
      lastAiDay: DAY,
      aiUsage: { qa: 3, stories: 1 },
    });
    expect(second.nextCursor).toBeUndefined();

    const search = await (await get("/admin/users?q=CARO", t)).json();
    expect(search.users.map((user: { email?: string }) => user.email)).toEqual(["caro@ejemplo.hn"]);
    expect((await t.fetch("/admin/users")).status).toBe(401);
  });

  it("backfill programa un rollup por día, con tope de 90", async () => {
    const t = setup();
    expect(await t.mutation(internal.adminAdapter.backfill, { days: 500 })).toEqual({ scheduled: 90 });
  });
});
