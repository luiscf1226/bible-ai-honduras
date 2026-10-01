import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { parseBuildNumber } from "./appVersion";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./appVersion.ts": () => import("./appVersion"),
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseBuildNumber", () => {
  it("acepta enteros y rechaza lo demás", () => {
    expect(parseBuildNumber("14")).toBe(14);
    expect(parseBuildNumber(" 14 ")).toBe(14);
    expect(parseBuildNumber("1.2")).toBeNull();
    expect(parseBuildNumber("")).toBeNull();
    expect(parseBuildNumber(undefined)).toBeNull();
  });
});

describe("appVersion.latest", () => {
  it("devuelve el build de cada plataforma desde el entorno", async () => {
    vi.stubEnv("LATEST_IOS_BUILD", "14");
    vi.stubEnv("LATEST_ANDROID_BUILD", "9");
    const t = convexTest(schema, modules);

    expect(await t.query(api.appVersion.latest, { platform: "ios" })).toEqual({ latestBuild: 14 });
    expect(await t.query(api.appVersion.latest, { platform: "android" })).toEqual({ latestBuild: 9 });
  });

  it("sin variable no hay build conocido (y la app no avisa)", async () => {
    vi.stubEnv("LATEST_IOS_BUILD", undefined);
    const t = convexTest(schema, modules);

    expect(await t.query(api.appVersion.latest, { platform: "ios" })).toEqual({ latestBuild: null });
  });
});
