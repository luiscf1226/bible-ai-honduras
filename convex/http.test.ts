import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./entitlements.ts": () => import("./entitlements"),
  "./http.ts": () => import("./http"),
};

describe("POST /revenuecat (ruta http)", () => {
  it("sin Authorization responde 401 (fail closed si no hay env)", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch("/revenuecat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: { type: "INITIAL_PURCHASE", app_user_id: "user_x", entitlement_ids: ["pro"] },
      }),
    });
    expect(response.status).toBe(401);
  });
});
