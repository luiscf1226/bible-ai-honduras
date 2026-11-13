import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { charge, QUOTA_LIMITS, refund } from "./quotas";
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

  it("un usuario Pro no tiene límite, pero su uso se cuenta para las métricas", async () => {
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
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ module: "qa", count: QUOTA_LIMITS.qa + 3 });
    expect(usage[0]?.denied).toBeUndefined();
  });

  it("historias: una gratis por día; la vieja fila lifetime ya no cuenta", async () => {
    const t = convexTest(schema, modules);
    const { authed, userId } = await seedUser(t, "user_stories");
    await t.run((ctx) => ctx.db.insert("usage", { userId, module: "stories", day: "lifetime", count: 1 }));

    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "stories" })).toEqual({ allowed: true });
    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "stories" })).toEqual({
      allowed: false,
      reason: "limit_reached",
      module: "stories",
    });
  });

  it("anota cada rechazo en `denied` sin sumar uso", async () => {
    const t = convexTest(schema, modules);
    const { authed } = await seedUser(t, "user_denied");
    for (let i = 0; i < QUOTA_LIMITS.qa + 2; i += 1) {
      await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    }
    const rows = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: QUOTA_LIMITS.qa, denied: 2 });
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
    expect(remaining).toMatchObject({ used: 1, remaining: QUOTA_LIMITS.voices - 1, isPro: false });
  });
});

describe("quotas.refund", () => {
  it("devuelve al día en que se cobró aunque la falla llegue pasada la medianoche", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedUser(t, "user_refund");
    const charged = await t.run((ctx) => charge(ctx, userId, "verseImage"));
    expect(charged).toMatchObject({ allowed: true });
    const day = (charged as { day: string }).day;
    await t.run((ctx) => ctx.db.insert("usage", { userId, module: "verseImage", day: "2099-01-01", count: 1 }));

    await t.run((ctx) => refund(ctx, userId, "verseImage", day));
    const rows = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(Object.fromEntries(rows.map((row) => [row.day, row.count]))).toEqual({ [day]: 0, "2099-01-01": 1 });
  });
});

describe("límite diario y medianoche de Honduras", () => {
  afterEach(() => vi.useRealTimers());

  // Honduras es UTC-6 todo el año: la medianoche local son las 06:00 UTC.
  const at = (iso: string) => vi.setSystemTime(Date.parse(iso));

  async function useUp(authed: ReturnType<typeof asUser>, module: "qa" | "voices" | "stories") {
    for (let i = 0; i < QUOTA_LIMITS[module]; i += 1) {
      expect(await authed.mutation(api.quotas.checkAndConsume, { module })).toEqual({ allowed: true });
    }
    expect(await authed.mutation(api.quotas.checkAndConsume, { module })).toEqual({
      allowed: false,
      reason: "limit_reached",
      module,
    });
  }

  for (const module of ["qa", "voices", "stories"] as const) {
    it(`${module}: se agota en el día y vuelve a las 00:00 de Tegucigalpa, no antes`, async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const t = convexTest(schema, modules);
      at("2026-11-13T15:00:00Z"); // 09:00 del 13 en Honduras
      const { authed } = await seedUser(t, `user_midnight_${module}`);
      await useUp(authed, module);

      // Medianoche UTC son las 18:00 del mismo día en Honduras: sigue agotado.
      at("2026-11-14T00:00:00Z");
      expect(await authed.mutation(api.quotas.checkAndConsume, { module })).toMatchObject({ allowed: false });
      at("2026-11-14T05:59:59Z"); // 23:59:59 del 13
      expect(await authed.query(api.quotas.remaining, { module })).toMatchObject({ remaining: 0 });
      expect(await authed.mutation(api.quotas.checkAndConsume, { module })).toMatchObject({ allowed: false });

      at("2026-11-14T06:00:00Z"); // 00:00 del 14
      expect(await authed.query(api.quotas.remaining, { module })).toMatchObject({
        used: 0,
        remaining: QUOTA_LIMITS[module],
      });
      await useUp(authed, module);
    });
  }

  it("el uso queda en el día en que se hizo: el 13 y el 14 son filas distintas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = convexTest(schema, modules);
    at("2026-11-14T05:30:00Z");
    const { authed } = await seedUser(t, "user_two_days");
    await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    at("2026-11-14T06:30:00Z");
    await authed.mutation(api.quotas.checkAndConsume, { module: "qa" });
    const rows = await t.run((ctx) => ctx.db.query("usage").collect());
    expect(Object.fromEntries(rows.map((row) => [row.day, row.count]))).toEqual({ "2026-11-13": 1, "2026-11-14": 1 });
  });

  it("si Pro vence, el límite vuelve ese mismo día", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = convexTest(schema, modules);
    at("2026-11-13T15:00:00Z");
    const { authed } = await seedUser(t, "user_pro_expires");
    await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_pro_expires",
      isPro: true,
      expiresAt: Date.parse("2026-11-13T16:00:00Z"),
    });
    for (let i = 0; i < QUOTA_LIMITS.qa + 1; i += 1) {
      expect(await authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).toEqual({ allowed: true });
    }
    at("2026-11-13T17:00:00Z");
    expect(await authed.mutation(api.quotas.checkAndConsume, { module: "qa" })).toMatchObject({ allowed: false });
  });

  it("usar la IA marca la cuenta como activa ese día (hora de Honduras)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const t = convexTest(schema, modules);
    at("2026-11-13T15:00:00Z");
    const { authed, userId } = await seedUser(t, "user_active");
    at("2026-11-15T03:00:00Z"); // 21:00 del 14 en Honduras
    await authed.mutation(api.quotas.checkAndConsume, { module: "voices" });
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user?.activeDays).toEqual(["2026-11-13", "2026-11-14"]);
  });
});
