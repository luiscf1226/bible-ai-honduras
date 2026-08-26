import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { makeReferralCode } from "./users";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string, extra: Record<string, unknown> = {}) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev", ...extra });
}

describe("users.current", () => {
  it("devuelve null sin sesión", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.current, {})).toBeNull();
  });

  it("devuelve null si el JWT es válido pero upsert todavía no corrió", async () => {
    const t = convexTest(schema, modules);
    expect(await asUser(t, "user_123").query(api.users.current, {})).toBeNull();
  });
});

describe("users.upsert", () => {
  it("crea el espejo local del usuario la primera vez, con RVR1960 por defecto", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_abc", { email: "ana@example.hn", name: "Ana" });

    const userId = await authed.mutation(api.users.upsert, {});
    const user = await t.run((ctx) => ctx.db.get(userId));

    expect(user).toMatchObject({
      clerkId: "user_abc",
      email: "ana@example.hn",
      name: "Ana",
      bibleVersion: "RVR1960",
      referralCode: makeReferralCode("user_abc"),
    });
  });

  it("es idempotente: llamarlo dos veces no duplica el usuario", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_dup", { email: "dup@example.hn" });

    const firstId = await authed.mutation(api.users.upsert, {});
    const secondId = await authed.mutation(api.users.upsert, {});
    expect(secondId).toBe(firstId);

    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
  });

  it("refresca email y nombre si cambiaron en Clerk, sin tocar preferencias", async () => {
    const t = convexTest(schema, modules);
    const original = asUser(t, "user_refresh", { email: "old@example.hn", name: "Nombre Viejo" });
    const userId = await original.mutation(api.users.upsert, {});
    await original.mutation(api.users.updatePreferences, { reminderHour: 7 });

    const updated = asUser(t, "user_refresh", { email: "new@example.hn", name: "Nombre Nuevo" });
    await updated.mutation(api.users.upsert, {});

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({
      email: "new@example.hn",
      name: "Nombre Nuevo",
      bibleVersion: "RVR1960",
      reminderHour: 7,
    });
  });

  it("requiere sesión", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.users.upsert, {})).rejects.toThrow("No autenticado");
  });

  it("nunca confía en un userId pasado por argumento — no hay ninguno que aceptar", async () => {
    // users.upsert no toma argumentos: la identidad sale siempre de ctx.auth.getUserIdentity().
    const t = convexTest(schema, modules);
    const alice = asUser(t, "user_alice", { email: "alice@example.hn" });
    const bob = asUser(t, "user_bob", { email: "bob@example.hn" });

    const aliceId = await alice.mutation(api.users.upsert, {});
    const bobId = await bob.mutation(api.users.upsert, {});
    expect(aliceId).not.toBe(bobId);
  });
});

describe("users.updatePreferences", () => {
  it("actualiza darkMode del usuario autenticado", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_dark");
    const userId = await authed.mutation(api.users.upsert, {});

    await authed.mutation(api.users.updatePreferences, { darkMode: true });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ darkMode: true });
  });

  it("actualiza bibleVersion y reminderHour del usuario autenticado", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_prefs");
    const userId = await authed.mutation(api.users.upsert, {});

    await authed.mutation(api.users.updatePreferences, { bibleVersion: "RVR1960", reminderHour: 6 });

    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ bibleVersion: "RVR1960", reminderHour: 6 });
  });

  it("persiste las horas de aviso del prototipo (6, 12, 21) para que #10 las consuma", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_hours");
    const userId = await authed.mutation(api.users.upsert, {});

    for (const hour of [6, 12, 21]) {
      await authed.mutation(api.users.updatePreferences, { reminderHour: hour });
      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user?.reminderHour).toBe(hour);
    }
  });

  it("rechaza reminderHour fuera de 0-23", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_bad_hour");
    await authed.mutation(api.users.upsert, {});

    await expect(
      authed.mutation(api.users.updatePreferences, { reminderHour: 24 }),
    ).rejects.toThrow("reminderHour");
    await expect(
      authed.mutation(api.users.updatePreferences, { reminderHour: -1 }),
    ).rejects.toThrow("reminderHour");
  });

  it("falla si el usuario no existe todavía", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_missing");
    await expect(
      authed.mutation(api.users.updatePreferences, { bibleVersion: "NVI" }),
    ).rejects.toThrow("Usuario no encontrado");
  });

  it("requiere sesión", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.updatePreferences, { bibleVersion: "NVI" }),
    ).rejects.toThrow("No autenticado");
  });
});

describe("users.acceptAiConsent", () => {
  it("registra consentimiento explicito con version", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_consent");
    const userId = await authed.mutation(api.users.upsert, {});

    const result = await authed.mutation(api.users.acceptAiConsent, {});
    const user = await t.run((ctx) => ctx.db.get(userId));

    expect(result.version).toBe("2026-08-25");
    expect(user?.aiConsentAt).toBe(result.acceptedAt);
    expect(await authed.query(api.users.requireAiConsent, {})).toBe(true);
  });

  it("bloquea IA sin consentimiento", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_without_consent");
    await authed.mutation(api.users.upsert, {});
    await expect(authed.query(api.users.requireAiConsent, {})).rejects.toThrow("AI_CONSENT_REQUIRED");
  });
});

describe("makeReferralCode", () => {
  it("es determinístico para el mismo clerkId", () => {
    expect(makeReferralCode("user_2abcXYZ")).toBe(makeReferralCode("user_2abcXYZ"));
  });

  it("difiere entre usuarios distintos", () => {
    expect(makeReferralCode("user_aaa111")).not.toBe(makeReferralCode("user_bbb222"));
  });
});

describe("bibleVersion sin corpus (#93 §4b)", () => {
  it("elegir NVI se guarda como RVR1960: el schema la acepta pero no hay corpus", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_nvi");
    await authed.mutation(api.users.upsert, {});

    await authed.mutation(api.users.updatePreferences, { bibleVersion: "NVI" });

    expect(await authed.query(api.users.current, {})).toMatchObject({
      bibleVersion: "RVR1960",
    });
  });

  it("migrateUnavailableBibleVersions devuelve a RVR1960 a quien quedó en NVI", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_legacy_nvi");
    await authed.mutation(api.users.upsert, {});
    // Simula una fila escrita antes de desactivar NVI.
    await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_legacy_nvi"))
        .unique();
      await ctx.db.patch(user!._id, { bibleVersion: "NVI" });
    });

    const result = await t.mutation(internal.users.migrateUnavailableBibleVersions, {});
    expect(result).toMatchObject({ migrated: 1 });

    expect(await authed.query(api.users.current, {})).toMatchObject({
      bibleVersion: "RVR1960",
    });
  });

  it("la migración es idempotente y no toca a quien ya está en RVR1960", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_ok").mutation(api.users.upsert, {});
    expect(await t.mutation(internal.users.migrateUnavailableBibleVersions, {})).toMatchObject({
      migrated: 0,
    });
  });
});
