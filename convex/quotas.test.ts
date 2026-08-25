import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { QUOTA_LIMITS } from "./quotas";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./entitlements.ts": () => import("./entitlements"),
  "./quotas.ts": () => import("./quotas"),
  "./devotional.ts": () => import("./devotional"),
  "./devotionalCatalog.ts": () => import("./devotionalCatalog"),
};

function asUser(
  t: ReturnType<typeof convexTest>,
  clerkId: string,
  extra: Record<string, unknown> = {},
) {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://example-dev.clerk.accounts.dev",
    ...extra,
  });
}

async function seedUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  const authed = asUser(t, clerkId);
  const userId = await authed.mutation(api.users.upsert, {});
  return { authed, userId };
}

describe("quotas.checkAndConsume", () => {
  it("un usuario free puede consumir 5 qa y la sexta es limit_reached", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_qa");

    for (let i = 0; i < QUOTA_LIMITS.qa; i += 1) {
      await expect(authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).resolves.toEqual({
        allowed: true,
      });
    }

    await expect(authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).resolves.toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "qa",
    });
  });

  it("dos consumes seguidos no saltan el límite (mutation serializada)", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_serial");

    for (let i = 0; i < QUOTA_LIMITS.qa - 1; i += 1) {
      await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    }

    const fifth = await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    const sixth = await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    expect(fifth).toEqual({ allowed: true });
    expect(sixth).toEqual({ allowed: false, reason: "limit_reached", module: "qa" });
  });

  it("un usuario Pro no incrementa ni se le acaba la cuota de qa", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_pro_qa");
    await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_pro_qa",
      isPro: true,
    });

    for (let i = 0; i < QUOTA_LIMITS.qa + 3; i += 1) {
      await expect(authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).resolves.toEqual({
        allowed: true,
      });
    }

    const usage = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(usage).toHaveLength(0);
  });

  it("stories usa la clave lifetime y no se resetea con otro day key", async () => {
    const t = convexTest(schema, modules);
    const { authed, userId } = await seedUser(t, "user_stories");

    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "stories" })).toEqual({
      allowed: true,
    });
    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "stories" })).toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "stories",
    });

    const lifetime = await t.run((ctx) =>
      ctx.db
        .query("usage")
        .withIndex("by_user_module_day", (q) =>
          q.eq("userId", userId).eq("module", "stories").eq("day", "lifetime"),
        )
        .unique(),
    );
    expect(lifetime?.count).toBe(1);

    await t.run(async (ctx) => {
      await ctx.db.insert("usage", {
        userId,
        module: "stories",
        day: "2026-01-01",
        count: 0,
      });
    });

    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "stories" })).toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "stories",
    });
    expect(lifetime).toMatchObject({ day: "lifetime", count: 1 });
  });

  it("feelings se agota a las 3", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_feelings");
    await authed.mutation(api.quotas.checkAndConsume, { module: "feelings" });
    await authed.mutation(api.quotas.checkAndConsume, { module: "feelings" });
    await authed.mutation(api.quotas.checkAndConsume, { module: "feelings" });
    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "feelings" })).toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "feelings",
    });
  });

  it("requiere sesión y no acepta userId de otro (no hay argumento)", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.quotas.checkAndConsume, { module: "qa" })).rejects.toThrow(
      "No autenticado",
    );

    const alice = asUser(t, "user_alice_q");
    const bob = asUser(t, "user_bob_q");
    await alice.mutation(api.users.upsert, {});
    await bob.mutation(api.users.upsert, {});

    await alice.mutation(api.quotas.checkAndConsume, { module: "qa" });
    expect(await bob.query(api.quotas.remaining, { module: "qa" })).toMatchObject({
      used: 0,
      remaining: QUOTA_LIMITS.qa,
    });
    expect(await alice.query(api.quotas.remaining, { module: "qa" })).toMatchObject({ used: 1 });
  });

  it("falla si el usuario no corrió users.upsert", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_missing");
    await expect(authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).rejects.toThrow(
      "Usuario no encontrado",
    );
  });
});

describe("quotas.remaining", () => {
  it("refleja used / limit / remaining / isPro del usuario autenticado", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_rem");

    expect(await authed.query(api.quotas.remaining, { module: "qa" })).toEqual({
      used: 0,
      limit: 5,
      remaining: 5,
      isPro: false,
    });

    await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });

    expect(await authed.query(api.quotas.remaining, { module: "qa" })).toEqual({
      used: 2,
      limit: 5,
      remaining: 3,
      isPro: false,
    });

    await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_rem",
      isPro: true,
    });

    expect(await authed.query(api.quotas.remaining, { module: "qa" })).toEqual({
      used: 2,
      limit: 5,
      remaining: 5,
      isPro: true,
    });
  });

  it("requiere sesión", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.quotas.remaining, { module: "qa" })).rejects.toThrow("No autenticado");
  });
});

describe("quotas.checkAndConsumeForUser", () => {
  it("permite a una action interna consumir con userId de servidor", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "user_rag");

    expect(
      await t.mutation(internal.quotas.checkAndConsumeForUser, { userId, module: "voices" }),
    ).toEqual({ allowed: true });

    const remaining = await asUser(t, "user_rag").query(api.quotas.remaining, { module: "voices" });
    expect(remaining).toMatchObject({ used: 1, remaining: 4, isPro: false });
  });
});
