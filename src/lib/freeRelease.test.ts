import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMonthlyOffer, logIn, logOut, purchaseMonthly, purchasesConfigured,
  resetRevenueCatForTests, restorePurchases, setReferralAttribute, setRevenueCatNativeForTests,
} from "./revenuecat";

// No mock de releaseConfig: probar la política que se empaqueta para la tienda.
afterEach(() => { vi.unstubAllEnvs(); resetRevenueCatForTests(); });

describe("edición gratuita", () => {
  it("una key remota no activa el SDK, compras, login ni atribución", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "remote-key-left-in-eas");
    const native = {
      configure: vi.fn(), logIn: vi.fn(), logOut: vi.fn(), getOfferings: vi.fn(),
      purchasePackage: vi.fn(), restorePurchases: vi.fn(), setAttributes: vi.fn(),
    };
    setRevenueCatNativeForTests(native);
    expect(purchasesConfigured()).toBe(false);
    for (const run of [logIn("review-user"), logOut(), getMonthlyOffer("review-user"),
      purchaseMonthly("review-user"), restorePurchases("review-user")]) {
      expect(await run).toEqual({ ok: false, reason: "not_configured" });
    }
    await setReferralAttribute("BAH-1234567");
    for (const operation of Object.values(native)) expect(operation).not.toHaveBeenCalled();
  });

});
