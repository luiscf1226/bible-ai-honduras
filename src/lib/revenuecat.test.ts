import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  logIn,
  purchaseMonthly,
  resetRevenueCatForTests,
  restorePurchases,
  setRevenueCatNativeForTests,
  type RevenueCatNative,
} from "./revenuecat";

function mockNative(overrides: Partial<RevenueCatNative> = {}): RevenueCatNative {
  return {
    configure: vi.fn(),
    getOfferings: vi.fn().mockResolvedValue({
      current: { monthly: { identifier: "$rc_monthly" } },
    }),
    logIn: vi.fn().mockResolvedValue({}),
    purchasePackage: vi.fn().mockResolvedValue({}),
    restorePurchases: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe("revenuecat purchase + identity", () => {
  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
  });

  afterEach(() => {
    resetRevenueCatForTests();
    vi.unstubAllEnvs();
  });

  it("logIn vincula el App User ID al clerkId y no lee CustomerInfo para isPro", async () => {
    const native = mockNative();
    setRevenueCatNativeForTests(native);

    await expect(logIn("user_clerk_ana")).resolves.toEqual({ ok: true });
    expect(native.configure).toHaveBeenCalledWith({
      apiKey: "test_public_key",
      appUserID: "user_clerk_ana",
    });
    expect(native.logIn).toHaveBeenCalledWith("user_clerk_ana");
    expect(native).not.toHaveProperty("getCustomerInfo");
  });

  it("purchaseMonthly compra el paquete monthly del offering default", async () => {
    const monthly = { identifier: "$rc_monthly" };
    const native = mockNative({
      getOfferings: vi.fn().mockResolvedValue({ current: { monthly } }),
    });
    setRevenueCatNativeForTests(native);

    await expect(purchaseMonthly("user_clerk_ana")).resolves.toEqual({ ok: true });
    expect(native.logIn).toHaveBeenCalledWith("user_clerk_ana");
    expect(native.purchasePackage).toHaveBeenCalledWith(monthly);
  });

  it("sin módulo nativo (Expo Go / web) no finge una compra", async () => {
    setRevenueCatNativeForTests(null);
    await expect(purchaseMonthly("user_clerk_ana")).resolves.toEqual({
      ok: false,
      reason: "dev_build_required",
    });
  });

  it("si el usuario cancela, no reporta éxito", async () => {
    const native = mockNative({
      purchasePackage: vi.fn().mockRejectedValue({ userCancelled: true }),
    });
    setRevenueCatNativeForTests(native);

    await expect(purchaseMonthly("user_x")).resolves.toEqual({
      ok: false,
      reason: "user_cancelled",
    });
  });

  it("restorePurchases llama al SDK y no decide isPro", async () => {
    const native = mockNative();
    setRevenueCatNativeForTests(native);

    await expect(restorePurchases("user_clerk_ana")).resolves.toEqual({ ok: true });
    expect(native.logIn).toHaveBeenCalledWith("user_clerk_ana");
    expect(native.restorePurchases).toHaveBeenCalledOnce();
  });
});
