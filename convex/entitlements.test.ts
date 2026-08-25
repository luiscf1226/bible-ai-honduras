import { convexTest } from "convex-test";
import type { GenericActionCtx } from "convex/server";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import {
  authorizationHeaderIsValid,
  handleRevenueCatWebhook,
  parseRevenueCatEvent,
  proStatusFromEvent,
} from "./entitlements";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./entitlements.ts": () => import("./entitlements"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

describe("authorizationHeaderIsValid", () => {
  it("acepta Bearer + secreto y rechaza el secreto incorrecto", () => {
    expect(authorizationHeaderIsValid("Bearer secret", "secret")).toBe(true);
    expect(authorizationHeaderIsValid("secret", "secret")).toBe(true);
    expect(authorizationHeaderIsValid("Bearer other", "secret")).toBe(false);
    expect(authorizationHeaderIsValid(null, "secret")).toBe(false);
    expect(authorizationHeaderIsValid("Bearer secret", undefined)).toBe(false);
  });
});

describe("proStatusFromEvent", () => {
  it("INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION con pro desbloquean", () => {
    expect(proStatusFromEvent("INITIAL_PURCHASE", ["pro"])).toEqual({ isPro: true });
    expect(proStatusFromEvent("RENEWAL", ["pro"])).toEqual({ isPro: true });
    expect(proStatusFromEvent("PRODUCT_CHANGE", ["pro"])).toEqual({ isPro: true });
    expect(proStatusFromEvent("UNCANCELLATION", ["pro"])).toEqual({ isPro: true });
  });

  it("EXPIRATION o sin pro revoca; CANCELLATION con pro sigue activo", () => {
    expect(proStatusFromEvent("EXPIRATION", ["pro"])).toEqual({ isPro: false });
    expect(proStatusFromEvent("INITIAL_PURCHASE", [])).toEqual({ isPro: false });
    expect(proStatusFromEvent("CANCELLATION", ["pro"])).toEqual({ isPro: true });
    expect(proStatusFromEvent("CANCELLATION", [])).toEqual({ isPro: false });
  });
});

describe("entitlements.upsertFromWebhook", () => {
  it("una compra inicial marca Pro al usuario que ya existe", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_ana").mutation(api.users.upsert, {});

    const result = await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_ana",
      isPro: true,
      expiresAt: 9_999_999_999_000,
    });
    expect(result.ignored).toBe(false);

    const mine = await asUser(t, "user_ana").query(api.entitlements.mine, {});
    expect(mine).toMatchObject({ isPro: true, expiresAt: 9_999_999_999_000 });
  });

  it("un app_user_id desconocido no crea usuario", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_ghost",
      isPro: true,
    });
    expect(result).toEqual({ ignored: true });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("EXPIRATION baja isPro", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_bob").mutation(api.users.upsert, {});
    await t.mutation(internal.entitlements.upsertFromWebhook, { clerkId: "user_bob", isPro: true });
    await t.mutation(internal.entitlements.upsertFromWebhook, { clerkId: "user_bob", isPro: false });
    expect(await asUser(t, "user_bob").query(api.entitlements.mine, {})).toMatchObject({ isPro: false });
  });

  it("mine es null sin sesión o sin fila, y Alice no ve el Pro de Bob", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.entitlements.mine, {})).toBeNull();

    const alice = asUser(t, "user_alice");
    const bob = asUser(t, "user_bob_e");
    await alice.mutation(api.users.upsert, {});
    await bob.mutation(api.users.upsert, {});
    expect(await alice.query(api.entitlements.mine, {})).toBeNull();

    await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_alice",
      isPro: true,
    });
    expect(await alice.query(api.entitlements.mine, {})).toMatchObject({ isPro: true });
    expect(await bob.query(api.entitlements.mine, {})).toBeNull();
  });

  it("es idempotente: dos upserts no duplican la fila", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_dup").mutation(api.users.upsert, {});
    await t.mutation(internal.entitlements.upsertFromWebhook, { clerkId: "user_dup", isPro: true });
    await t.mutation(internal.entitlements.upsertFromWebhook, { clerkId: "user_dup", isPro: true });
    const rows = await t.run((ctx) => ctx.db.query("entitlements").collect());
    expect(rows).toHaveLength(1);
  });

  it("un Pro vencido se trata como free", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_stale").mutation(api.users.upsert, {});
    await t.mutation(internal.entitlements.upsertFromWebhook, {
      clerkId: "user_stale",
      isPro: true,
      expiresAt: 1,
    });
    expect(await asUser(t, "user_stale").query(api.entitlements.mine, {})).toMatchObject({
      isPro: false,
    });
  });
});

describe("parseRevenueCatEvent", () => {
  it("lee type, app_user_id, entitlement_ids y expiration_at_ms", () => {
    expect(
      parseRevenueCatEvent({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user_clerk",
          entitlement_ids: ["pro"],
          expiration_at_ms: 1_700_000_000_000,
        },
      }),
    ).toEqual({
      type: "INITIAL_PURCHASE",
      appUserId: "user_clerk",
      entitlementIds: ["pro"],
      expirationAtMs: 1_700_000_000_000,
    });
  });

  it("rechaza cuerpos sin event.type o app_user_id", () => {
    expect(parseRevenueCatEvent(null)).toBeNull();
    expect(parseRevenueCatEvent({})).toBeNull();
    expect(parseRevenueCatEvent({ event: { type: "INITIAL_PURCHASE" } })).toBeNull();
  });
});

describe("handleRevenueCatWebhook", () => {
  const fixture = "secret";

  function ctx(t: ReturnType<typeof convexTest>) {
    return {
      runMutation: async (
        _ref: unknown,
        args: { clerkId: string; isPro: boolean; expiresAt?: number },
      ) => t.mutation(internal.entitlements.upsertFromWebhook, args),
    } as Pick<GenericActionCtx<DataModel>, "runMutation">;
  }

  function request(
    appUserId: string,
    type: string,
    entitlementIds: string[] | null,
    authorization?: string,
  ) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (authorization !== undefined) {
      headers.set("Authorization", authorization);
    }
    return new Request("https://example.convex.site/revenuecat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: {
          type,
          app_user_id: appUserId,
          entitlement_ids: entitlementIds,
          expiration_at_ms: 1_800_000_000_000,
        },
      }),
    });
  }

  it("Authorization válida + INITIAL_PURCHASE con pro deja isPro true", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_hook").mutation(api.users.upsert, {});
    const response = await handleRevenueCatWebhook(
      ctx(t),
      request("user_hook", "INITIAL_PURCHASE", ["pro"], `Bearer ${fixture}`),
      fixture,
    );
    expect(response.status).toBe(200);
    expect(await asUser(t, "user_hook").query(api.entitlements.mine, {})).toMatchObject({
      isPro: true,
    });
  });

  it("Authorization incorrecta o ausente responde 401 y no escribe entitlements", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_401").mutation(api.users.upsert, {});

    expect(
      (
        await handleRevenueCatWebhook(
          ctx(t),
          request("user_401", "INITIAL_PURCHASE", ["pro"], "Bearer other"),
          fixture,
        )
      ).status,
    ).toBe(401);
    expect(
      (await handleRevenueCatWebhook(ctx(t), request("user_401", "INITIAL_PURCHASE", ["pro"]), fixture))
        .status,
    ).toBe(401);
    expect(
      (
        await handleRevenueCatWebhook(
          ctx(t),
          request("user_401", "INITIAL_PURCHASE", ["pro"], `Bearer ${fixture}`),
          undefined,
        )
      ).status,
    ).toBe(401);

    expect(await asUser(t, "user_401").query(api.entitlements.mine, {})).toBeNull();
    expect(await t.run((c) => c.db.query("entitlements").collect())).toHaveLength(0);
  });

  it("EXPIRATION deja isPro false", async () => {
    const t = convexTest(schema, modules);
    await asUser(t, "user_exp").mutation(api.users.upsert, {});
    await handleRevenueCatWebhook(
      ctx(t),
      request("user_exp", "INITIAL_PURCHASE", ["pro"], `Bearer ${fixture}`),
      fixture,
    );
    const expired = await handleRevenueCatWebhook(
      ctx(t),
      request("user_exp", "EXPIRATION", ["pro"], `Bearer ${fixture}`),
      fixture,
    );
    expect(expired.status).toBe(200);
    expect(await asUser(t, "user_exp").query(api.entitlements.mine, {})).toMatchObject({
      isPro: false,
    });
  });

  it("app_user_id desconocido responde 200 y no crea users", async () => {
    const t = convexTest(schema, modules);
    const response = await handleRevenueCatWebhook(
      ctx(t),
      request("user_nobody", "INITIAL_PURCHASE", ["pro"], `Bearer ${fixture}`),
      fixture,
    );
    expect(response.status).toBe(200);
    expect(await t.run((c) => c.db.query("users").collect())).toHaveLength(0);
    expect(await t.run((c) => c.db.query("entitlements").collect())).toHaveLength(0);
  });
});
