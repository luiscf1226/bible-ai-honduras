import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { activeAccounts, withActiveDay } from "./activeDays";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
};

afterEach(() => vi.useRealTimers());

describe("withActiveDay", () => {
  it("agrega el día una sola vez y guarda solo los últimos 30", () => {
    expect(withActiveDay(undefined, "2026-11-13")).toEqual(["2026-11-13"]);
    expect(withActiveDay(["2026-11-13"], "2026-11-13")).toBeNull();
    expect(withActiveDay(["2026-10-14", "2026-10-15", "2026-11-12"], "2026-11-13")).toEqual([
      "2026-10-15",
      "2026-11-12",
      "2026-11-13",
    ]);
  });
});

describe("activeAccounts", () => {
  it("cuenta cada cuenta una vez por ventana, sin días posteriores", () => {
    const users = [
      { activeDays: ["2026-11-01", "2026-11-13"] },
      { activeDays: ["2026-11-08"] },
      { activeDays: ["2026-10-20"] },
      { activeDays: ["2026-11-14"] },
      {},
    ];
    expect(activeAccounts(users, "2026-11-13")).toEqual({ day: 1, week: 2, month: 3 });
  });
});

describe("users.upsert marca el día activo", () => {
  it("abrir la app con sesión deja el día de Honduras en la cuenta", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-13T05:00:00Z")); // 23:00 del 12 en Honduras
    const t = convexTest(schema, modules);
    const authed = t.withIdentity({ subject: "user_open", issuer: "https://example-dev.clerk.accounts.dev" });
    const userId = await authed.mutation(api.users.upsert, {});
    vi.setSystemTime(Date.parse("2026-11-13T07:00:00Z")); // 01:00 del 13
    await authed.mutation(api.users.upsert, {});
    await authed.mutation(api.users.upsert, {});
    expect((await t.run((ctx) => ctx.db.get(userId)))?.activeDays).toEqual(["2026-11-12", "2026-11-13"]);
  });
});
