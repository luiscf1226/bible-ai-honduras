import { describe, expect, it } from "vitest";

import { PAYWALL_DISPLAY_PRICE, PAYWALL_FEATURES, paywallTokens } from "./paywallTokens";

describe("paywallTokens", () => {
  it("mide la paleta oscura del prototipo, no negro puro", () => {
    expect(paywallTokens.color.bgStart).toBe("#3B352E");
    expect(paywallTokens.color.bgMid).toBe("#2E2A25");
    expect(paywallTokens.color.bgEnd).toBe("#252220");
    expect(Object.values(paywallTokens.color)).not.toContain("#000000");
  });

  it("lista las 4 features Pro del prototipo y el precio de display", () => {
    expect(PAYWALL_FEATURES).toHaveLength(4);
    expect(PAYWALL_FEATURES[0].title).toBe("Preguntas sin contar");
    expect(PAYWALL_DISPLAY_PRICE).toBe("$4.99");
  });
});
