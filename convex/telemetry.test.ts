import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import adminKitSchema from "./adminKit/schema";
import schema from "./schema";
import { isValidInstallId, TELEMETRY_EVENTS, truncate } from "./telemetry";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./telemetry.ts": () => import("./telemetry"),
};
const adminKitModules = import.meta.glob(["./adminKit/**/*.ts", "!./adminKit/**/*.test.ts"]);

// Desde #235 las filas viven en el kit de admin (convex/adminKit).
type KitDb = {
  db: {
    insert: (table: string, row: Record<string, unknown>) => Promise<unknown>;
    query: (table: string) => { collect: () => Promise<Array<Record<string, any>>> };
  };
};
function setup() {
  const t = convexTest(schema, modules);
  t.registerComponent("adminKit", adminKitSchema, adminKitModules);
  return t;
}

// `runInComponent` existe en convex-test pero sus tipos todavía no lo exponen.
function kit<T>(t: ReturnType<typeof setup>, fn: (ctx: KitDb) => Promise<T>): Promise<T> {
  const runner = t as unknown as { runInComponent: (path: string, fn: (ctx: KitDb) => Promise<T>) => Promise<T> };
  return runner.runInComponent("adminKit", fn);
}

const INSTALL = "0f3a9c2e-1b7d-4e8a-9c3f-5d2e7a1b9c4f";
const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("telemetry.track", () => {
  it("guarda el evento sin ningún dato de la cuenta", async () => {
    const t = setup();
    await t
      .withIdentity({ subject: "user_123", email: "ana@example.com" })
      .mutation(api.telemetry.track, { installId: INSTALL, name: "qa_asked", module: "qa", platform: "ios", build: "14" });

    const rows = await kit(t, (ctx) => ctx.db.query("events").collect());
    expect(rows).toHaveLength(1);
    const { _id, _creationTime, at, ...row } = rows[0];
    expect(row).toEqual({ installId: INSTALL, name: "qa_asked", module: "qa", platform: "ios", build: "14" });
    expect(JSON.stringify(rows[0])).not.toContain("user_123");
    expect(JSON.stringify(rows[0])).not.toContain("ana@example.com");
  });

  it("share_completed guarda el origen \"dedicated\" (#202); otros eventos no lo llevan", async () => {
    const t = setup();
    await t.mutation(api.telemetry.track, { installId: INSTALL, name: "share_completed", origin: "dedicated", platform: "ios" });
    await t.mutation(api.telemetry.track, { installId: INSTALL, name: "qa_asked", origin: "dedicated", platform: "ios" });
    const rows = await kit(t, (ctx) => ctx.db.query("events").collect());
    expect(rows.map((row) => [row.name, row.origin])).toEqual([
      ["share_completed", "dedicated"],
      ["qa_asked", undefined],
    ]);
    await expect(
      // @ts-expect-error: el validador frena un origen fuera de la lista.
      t.mutation(api.telemetry.track, { installId: INSTALL, name: "share_completed", origin: "para mamá", platform: "ios" }),
    ).rejects.toThrow();
  });

  it("funciona sin sesión (antes del login también hay embudo)", async () => {
    const t = setup();
    await t.mutation(api.telemetry.track, { installId: INSTALL, name: "app_opened", platform: "android" });
    expect(await kit(t, (ctx) => ctx.db.query("events").collect())).toHaveLength(1);
  });

  it("ignora un installId inválido en vez de lanzar", async () => {
    const t = setup();
    await t.mutation(api.telemetry.track, { installId: "x", name: "app_opened", platform: "ios" });
    await t.mutation(api.telemetry.track, { installId: "<script>alert(1)</script>", name: "app_opened", platform: "ios" });
    expect(await kit(t, (ctx) => ctx.db.query("events").collect())).toHaveLength(0);
  });

  it("rechaza nombres fuera de la lista cerrada", async () => {
    const t = setup();
    await expect(
      t.mutation(api.telemetry.track, {
        installId: INSTALL,
        // @ts-expect-error: el validador es el que tiene que frenarlo.
        name: "pregunta: ¿por qué sufro?",
        platform: "ios",
      }),
    ).rejects.toThrow();
  });
});

describe("telemetry.reportError", () => {
  it("recorta mensaje y stack", async () => {
    const t = setup();
    await t.mutation(api.telemetry.reportError, {
      installId: INSTALL,
      message: "m".repeat(1000),
      stack: "s".repeat(5000),
      fatal: true,
      platform: "ios",
    });
    const [row] = await kit(t, (ctx) => ctx.db.query("errors").collect());
    expect(row.message).toHaveLength(300);
    expect(row.stack).toHaveLength(2000);
    expect(row.fatal).toBe(true);
  });
});

describe("telemetry.purgeOld", () => {
  it("borra lo de más de 90 días y deja lo reciente", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-10-01T12:00:00Z");
    vi.setSystemTime(now);
    const t = setup();
    await kit(t, async (ctx) => {
      const base = { installId: INSTALL, platform: "ios" };
      await ctx.db.insert("events", { ...base, name: "app_opened", at: now - 91 * DAY_MS });
      await ctx.db.insert("events", { ...base, name: "app_opened", at: now - 89 * DAY_MS });
      await ctx.db.insert("errors", { ...base, message: "viejo", fatal: false, at: now - 120 * DAY_MS });
      await ctx.db.insert("errors", { ...base, message: "nuevo", fatal: false, at: now - DAY_MS });
      await ctx.db.insert("counters", { day: "2026-06-01", key: "voices.refused", count: 3 });
      await ctx.db.insert("counters", { day: "2026-09-30", key: "voices.refused", count: 1 });
    });

    expect(await t.mutation(internal.telemetry.purgeOld, {})).toEqual({ events: 1, errors: 1, counters: 1 });
    const errors = await kit(t, (ctx) => ctx.db.query("errors").collect());
    expect(errors.map((row) => row.message)).toEqual(["nuevo"]);
    expect(await kit(t, (ctx) => ctx.db.query("events").collect())).toHaveLength(1);
  });
});

describe("telemetry.funnel", () => {
  it("cuenta instalaciones distintas por evento, solo dentro del rango", async () => {
    vi.useFakeTimers();
    const now = Date.parse("2026-10-01T12:00:00Z");
    vi.setSystemTime(now);
    const t = setup();
    await kit(t, async (ctx) => {
      const event = (installId: string, name: string, daysAgo: number) =>
        ctx.db.insert("events", { installId, name, platform: "ios", at: now - daysAgo * DAY_MS });
      await event("aaaaaaaa", "app_opened", 1);
      await event("aaaaaaaa", "app_opened", 2);
      await event("bbbbbbbb", "app_opened", 1);
      await event("aaaaaaaa", "paywall_viewed", 1);
      await event("cccccccc", "app_opened", 30);
    });

    const funnel = await t.query(internal.telemetry.funnel, { days: 7 });
    expect(funnel.find((row) => row.name === "app_opened")).toEqual({ name: "app_opened", installs: 2, events: 3 });
    expect(funnel.find((row) => row.name === "paywall_viewed")).toEqual({ name: "paywall_viewed", installs: 1, events: 1 });
    expect(funnel.find((row) => row.name === "purchase_completed")?.installs).toBe(0);
  });
});

describe("telemetry.migrateToKit (#235)", () => {
  it("mueve las filas viejas al kit con su fecha y vacía las tablas de la app", async () => {
    const t = setup();
    const at = Date.parse("2026-09-01T12:00:00Z");
    await t.run(async (ctx) => {
      await ctx.db.insert("telemetryEvents", { installId: INSTALL, name: "share_completed", origin: "dedicated", platform: "ios", build: "14", at });
      await ctx.db.insert("clientErrors", { installId: INSTALL, message: "boom", fatal: true, platform: "android", at });
    });

    expect(await t.mutation(internal.telemetry.migrateToKit, {})).toEqual({ events: 1, errors: 1 });

    const events = await kit(t, (ctx) => ctx.db.query("events").collect());
    expect(events).toMatchObject([{ installId: INSTALL, name: "share_completed", origin: "dedicated", platform: "ios", build: "14", at }]);
    const errors = await kit(t, (ctx) => ctx.db.query("errors").collect());
    expect(errors).toMatchObject([{ message: "boom", fatal: true, platform: "android", at }]);
    expect(await t.run((ctx) => ctx.db.query("telemetryEvents").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("clientErrors").collect())).toHaveLength(0);
    expect(await t.mutation(internal.telemetry.migrateToKit, {})).toEqual({ events: 0, errors: 0 });
  });
});

describe("helpers", () => {
  it("el embudo devuelve todos los eventos en orden, aunque estén en cero", async () => {
    const t = setup();
    const funnel = await t.query(internal.telemetry.funnel, {});
    expect(funnel.map((row) => row.name)).toEqual([...TELEMETRY_EVENTS]);
  });

  it("isValidInstallId y truncate", () => {
    expect(isValidInstallId(INSTALL)).toBe(true);
    expect(isValidInstallId("corto")).toBe(false);
    expect(truncate("abcdef", 3)).toBe("abc");
    expect(truncate("ab", 3)).toBe("ab");
  });
});
