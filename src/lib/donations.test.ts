import { describe, expect, it } from "vitest";

import { donationUrl } from "./donations";

const url = "https://ejemplo.org/donar";

describe("donationUrl", () => {
  it("sin link configurado no hay pantalla de donaciones", () => {
    expect(donationUrl("android", { platforms: "android" })).toBeNull();
    expect(donationUrl("android", { url: "  ", platforms: "android" })).toBeNull();
  });

  it("cada plataforma se enciende a mano: iOS queda apagado si no está en la lista", () => {
    const env = { url, platforms: "android, web" };
    expect(donationUrl("android", env)).toBe(url);
    expect(donationUrl("web", env)).toBe(url);
    expect(donationUrl("ios", env)).toBeNull();
    expect(donationUrl("ios", { url })).toBeNull();
  });

  it("solo abre links https", () => {
    expect(donationUrl("android", { url: "http://ejemplo.org/donar", platforms: "android" })).toBeNull();
    expect(donationUrl("android", { url: "javascript:alert(1)", platforms: "android" })).toBeNull();
  });
});
