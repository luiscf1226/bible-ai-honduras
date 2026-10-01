import { describe, expect, it } from "vitest";

import { isUpdateAvailable, updateStoreName, updateUrls, versionLabel } from "./appVersion";

describe("versionLabel", () => {
  it("muestra versión y build", () => {
    expect(versionLabel("0.1.0", "12")).toBe("Versión 0.1.0 (build 12)");
  });

  it("sin build nativo (web / Expo Go) muestra solo la versión", () => {
    expect(versionLabel("0.1.0", null)).toBe("Versión 0.1.0");
    expect(versionLabel(null, null)).toBe("Versión desconocida");
  });
});

describe("isUpdateAvailable", () => {
  it("avisa cuando el servidor conoce un build más nuevo", () => {
    expect(isUpdateAvailable("12", 14)).toBe(true);
  });

  it("no avisa con el mismo build o uno más nuevo instalado", () => {
    expect(isUpdateAvailable("14", 14)).toBe(false);
    expect(isUpdateAvailable("15", 14)).toBe(false);
  });

  it("compara números, no strings ('9' < 10)", () => {
    expect(isUpdateAvailable("9", 10)).toBe(true);
  });

  it("sin cualquiera de los dos números no avisa", () => {
    expect(isUpdateAvailable(null, 14)).toBe(false);
    expect(isUpdateAvailable("12", null)).toBe(false);
    expect(isUpdateAvailable("1.0.3", 14)).toBe(false);
  });
});

describe("updateUrls", () => {
  it("iOS abre TestFlight en la ficha de la app, con fallback web", () => {
    expect(updateUrls("ios")).toEqual([
      "itms-beta://beta.itunes.apple.com/v1/app/6807627270",
      "https://beta.itunes.apple.com/v1/app/6807627270",
    ]);
    expect(updateStoreName("ios")).toBe("TestFlight");
  });

  it("Android abre Play con el package de app.json", () => {
    expect(updateUrls("android")[0]).toBe("market://details?id=com.bibleaihonduras.app");
    expect(updateStoreName("android")).toBe("Google Play");
  });
});
