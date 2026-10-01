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
    vi.stubEnv("MIN_IOS_BUILD", undefined);
    vi.stubEnv("MIN_ANDROID_BUILD", undefined);
    const t = convexTest(schema, modules);

    expect(await t.query(api.appVersion.latest, { platform: "ios" })).toEqual({ latestBuild: 14, minBuild: null });
    expect(await t.query(api.appVersion.latest, { platform: "android" })).toEqual({ latestBuild: 9, minBuild: null });
  });

  it("sin variable no hay build conocido (y la app no avisa)", async () => {
    vi.stubEnv("LATEST_IOS_BUILD", undefined);
    vi.stubEnv("MIN_IOS_BUILD", undefined);
    const t = convexTest(schema, modules);

    expect(await t.query(api.appVersion.latest, { platform: "ios" })).toEqual({ latestBuild: null, minBuild: null });
  });

  it("devuelve el piso de cada plataforma por separado", async () => {
    vi.stubEnv("MIN_IOS_BUILD", "12");
    vi.stubEnv("MIN_ANDROID_BUILD", "7");
    const t = convexTest(schema, modules);

    expect((await t.query(api.appVersion.latest, { platform: "ios" })).minBuild).toBe(12);
    expect((await t.query(api.appVersion.latest, { platform: "android" })).minBuild).toBe(7);
  });
});
