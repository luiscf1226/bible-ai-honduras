import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMonthlyOffer, logIn, logOut, purchaseMonthly, purchasesConfigured,
  resetRevenueCatForTests, restorePurchases, setReferralAttribute, setRevenueCatNativeForTests,
} from "./revenuecat";
import { paymentsMode } from "./releaseConfig";

// No mock de releaseConfig: probar la política que se empaqueta para la tienda.
afterEach(() => { vi.unstubAllEnvs(); resetRevenueCatForTests(); });

function spyNative() {
  return {
    configure: vi.fn(), logIn: vi.fn(), logOut: vi.fn(), getOfferings: vi.fn(),
    purchasePackage: vi.fn(), restorePurchases: vi.fn(), setAttributes: vi.fn(),
  };
}

describe("edición gratuita (sin EXPO_PUBLIC_PAYMENTS_MODE)", () => {
  it("una key remota no activa el SDK, compras, login ni atribución", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "remote-key-left-in-eas");
    const native = spyNative();
    setRevenueCatNativeForTests(native);
    expect(paymentsMode()).toBe("off");
    expect(purchasesConfigured()).toBe(false);
    for (const run of [logIn("review-user"), logOut(), getMonthlyOffer("review-user"),
      purchaseMonthly("review-user"), restorePurchases("review-user")]) {
      expect(await run).toEqual({ ok: false, reason: "not_configured" });
    }
    await setReferralAttribute("BAH-1234567");
    for (const operation of Object.values(native)) expect(operation).not.toHaveBeenCalled();
  });

  it("un valor desconocido cuenta como apagado", () => {
    vi.stubEnv("EXPO_PUBLIC_PAYMENTS_MODE", "si");
    expect(paymentsMode()).toBe("off");
  });
});

describe("modo de prueba (EXPO_PUBLIC_PAYMENTS_MODE=test)", () => {
  it("ofrece Pro a US$2.99 sin tocar RevenueCat ni pedir llaves", async () => {
    vi.stubEnv("EXPO_PUBLIC_PAYMENTS_MODE", "test");
    const native = spyNative();
    setRevenueCatNativeForTests(native);
    expect(await getMonthlyOffer("tester")).toEqual({
      ok: true,
      offer: { priceString: "US$2.99", title: "Bible AI Honduras Pro (prueba)" },
    });
    expect(purchasesConfigured()).toBe(false);
    expect(await purchaseMonthly("tester")).toEqual({ ok: false, reason: "not_configured" });
    for (const operation of Object.values(native)) expect(operation).not.toHaveBeenCalled();
  });
});

describe("compra real (EXPO_PUBLIC_PAYMENTS_MODE=revenuecat)", () => {
  it("sin la key pública no hay compra", () => {
    vi.stubEnv("EXPO_PUBLIC_PAYMENTS_MODE", "revenuecat");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    expect(purchasesConfigured()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
    expect(purchasesConfigured()).toBe(true);
  });
});
