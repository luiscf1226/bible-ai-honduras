import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { summarizeReferrals } from "./referrals";
import schema from "./schema";
import { makeReferralCode } from "./users";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./referrals.ts": () => import("./referrals"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

const DAY_MS = 24 * 60 * 60 * 1000;

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function signUp(t: ReturnType<typeof convexTest>, clerkId: string) {
  const user = asUser(t, clerkId);
  await user.mutation(api.users.upsert, {});
  return user;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("referrals.claim", () => {
  it("anota quién invitó y por dónde llegó", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "user_ana");
    const beto = await signUp(t, "user_beto");

    await expect(beto.mutation(api.referrals.claim, { code: makeReferralCode("user_ana").toLowerCase(), via: "play" })).resolves.toEqual({
      status: "ok",
    });
    const row = await beto.query(api.users.current, {});
    expect(row).toMatchObject({ referredBy: makeReferralCode("user_ana"), referredVia: "play" });
    expect(row?.referredAt).toBeTypeOf("number");
  });

  it("primero gana: un segundo código no pisa al primero", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "user_ana");
    await signUp(t, "user_carla");
    const beto = await signUp(t, "user_beto");

    await beto.mutation(api.referrals.claim, { code: makeReferralCode("user_ana"), via: "link" });
    await expect(beto.mutation(api.referrals.claim, { code: makeReferralCode("user_carla"), via: "manual" })).resolves.toEqual({
      status: "already",
    });
    expect((await beto.query(api.users.current, {}))?.referredBy).toBe(makeReferralCode("user_ana"));
  });

  it("rechaza el propio código, uno inválido y uno que no existe", async () => {
    const t = convexTest(schema, modules);
    const beto = await signUp(t, "user_beto");

    await expect(beto.mutation(api.referrals.claim, { code: makeReferralCode("user_beto"), via: "manual" })).resolves.toEqual({ status: "self" });
    await expect(beto.mutation(api.referrals.claim, { code: "hola", via: "manual" })).resolves.toEqual({ status: "invalid" });
    await expect(beto.mutation(api.referrals.claim, { code: "BAH-0000000", via: "manual" })).resolves.toEqual({ status: "not_found" });
    expect((await beto.query(api.users.current, {}))?.referredBy).toBeUndefined();
  });

  it("después de 30 días ya no se anota", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-01T12:00:00Z"));
    const t = convexTest(schema, modules);
    await signUp(t, "user_ana");
    const beto = await signUp(t, "user_beto");

    vi.setSystemTime(Date.parse("2026-09-01T12:00:00Z") + 31 * DAY_MS);
    await expect(beto.mutation(api.referrals.claim, { code: makeReferralCode("user_ana"), via: "manual" })).resolves.toEqual({
      status: "too_late",
    });
  });

  it("sin sesión no se puede", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.referrals.claim, { code: "BAH-0000000", via: "link" })).rejects.toThrow("No autenticado");
  });
});

describe("referrals.summary", () => {
  it("separa registros y Pro que vienen de invitaciones de los directos", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "user_ana");
    const beto = await signUp(t, "user_beto");
    const carla = await signUp(t, "user_carla");
    await signUp(t, "user_dani");
    await beto.mutation(api.referrals.claim, { code: makeReferralCode("user_ana"), via: "link" });
    await carla.mutation(api.referrals.claim, { code: makeReferralCode("user_ana"), via: "play" });
    await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      const byClerk = (id: string) => users.find((u) => u.clerkId === id)!._id;
      await ctx.db.insert("entitlements", { userId: byClerk("user_beto"), isPro: true, source: "test", updatedAt: Date.now() });
      await ctx.db.insert("entitlements", { userId: byClerk("user_dani"), isPro: true, source: "test", updatedAt: Date.now() });
      // Pro vencido: no cuenta.
      await ctx.db.insert("entitlements", { userId: byClerk("user_carla"), isPro: true, expiresAt: Date.now() - DAY_MS, source: "test", updatedAt: Date.now() });
    });

    const result = await t.query(internal.referrals.summary, {});
    expect(result.users).toEqual({ total: 4, referred: 2, direct: 2 });
    expect(result.pro).toEqual({ total: 2, referred: 1, direct: 1 });
    expect(result.byVia).toEqual({ link: 1, play: 1, manual: 0 });
    expect(result.topInviters).toEqual([{ code: makeReferralCode("user_ana"), signups: 2, pro: 1 }]);
  });

  it("summarizeReferrals ordena a quienes más Pro trajeron", () => {
    const rows = [
      { referredBy: "BAH-AAAAAAA", referredVia: "link" as const, isPro: false },
      { referredBy: "BAH-AAAAAAA", referredVia: "link" as const, isPro: false },
      { referredBy: "BAH-BBBBBBB", referredVia: "manual" as const, isPro: true },
    ];
    expect(summarizeReferrals(rows).topInviters.map((row) => row.code)).toEqual(["BAH-BBBBBBB", "BAH-AAAAAAA"]);
  });
});
