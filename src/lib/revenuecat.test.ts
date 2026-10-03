import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMonthlyOffer,
  logIn,
  logOut,
  purchasesConfigured,
  purchaseMonthly,
  resetRevenueCatForTests,
  restorePurchases,
  setReferralAttribute,
  setRevenueCatNativeForTests,
  type RevenueCatNative,
} from "./revenuecat";

function mockNative(overrides: Partial<RevenueCatNative> = {}): RevenueCatNative {
  return {
    configure: vi.fn(),
    getOfferings: vi.fn().mockResolvedValue({
      current: { monthly: { identifier: "$rc_monthly", product: { priceString: "US$4.99", title: "Bible AI Honduras Pro" } } },
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

describe("beta sin RevenueCat (#93)", () => {
  afterEach(() => {
    resetRevenueCatForTests();
    vi.unstubAllEnvs();
  });

  it("purchasesConfigured es false sin la key pública", () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    expect(purchasesConfigured()).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
    expect(purchasesConfigured()).toBe(true);
  });

  it("sin la key no lanza: devuelve not_configured y no toca el SDK nativo", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    const native = mockNative();
    setRevenueCatNativeForTests(native);

    await expect(purchaseMonthly("user_beta")).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
    await expect(restorePurchases("user_beta")).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });
    await expect(logIn("user_beta")).resolves.toEqual({
      ok: false,
      reason: "not_configured",
    });

    expect(native.configure).not.toHaveBeenCalled();
    expect(native.purchasePackage).not.toHaveBeenCalled();
    expect(native.restorePurchases).not.toHaveBeenCalled();
  });
});

describe("logOut al cerrar sesión (#107)", () => {
  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
  });

  afterEach(() => {
    resetRevenueCatForTests();
    vi.unstubAllEnvs();
  });

  it("desvincula el App User ID para que el próximo login no herede compras", async () => {
    const native = mockNative({ logOut: vi.fn().mockResolvedValue({}) });
    setRevenueCatNativeForTests(native);

    await expect(logOut()).resolves.toEqual({ ok: true });
    expect(native.logOut).toHaveBeenCalledOnce();
  });

  it("si el SDK se queja, no bloquea el cierre de sesión de la app", async () => {
    const native = mockNative({ logOut: vi.fn().mockRejectedValue(new Error("anonymous")) });
    setRevenueCatNativeForTests(native);

    await expect(logOut()).resolves.toEqual({ ok: false, reason: "purchase_failed" });
  });

  it("sin módulo nativo (Expo Go / web) no finge nada", async () => {
    setRevenueCatNativeForTests(null);
    await expect(logOut()).resolves.toEqual({ ok: false, reason: "dev_build_required" });
  });

  it("sin la key pública devuelve not_configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    const native = mockNative({ logOut: vi.fn() });
    setRevenueCatNativeForTests(native);

    await expect(logOut()).resolves.toEqual({ ok: false, reason: "not_configured" });
    expect(native.logOut).not.toHaveBeenCalled();
  });
});

describe("setReferralAttribute (PRD §9b)", () => {
  afterEach(() => {
    resetRevenueCatForTests();
    vi.unstubAllEnvs();
  });

  it("deja el código de quien invitó como atributo referred_by", async () => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
    const setAttributes = vi.fn().mockResolvedValue(undefined);
    setRevenueCatNativeForTests(mockNative({ setAttributes }));

    await setReferralAttribute("BAH-12AB34C");
    expect(setAttributes).toHaveBeenCalledWith({ referred_by: "BAH-12AB34C" });
  });

  it("nunca lanza: sin key, sin binding o si el SDK falla", async () => {
    await expect(setReferralAttribute("BAH-12AB34C")).resolves.toBeUndefined();

    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
    setRevenueCatNativeForTests(mockNative({ setAttributes: vi.fn().mockRejectedValue(new Error("sdk")) }));
    await expect(setReferralAttribute("BAH-12AB34C")).resolves.toBeUndefined();

    setRevenueCatNativeForTests(mockNative());
    await expect(setReferralAttribute("BAH-12AB34C")).resolves.toBeUndefined();
  });
});

describe("precio real de la tienda (#144)", () => {
  beforeEach(() => {
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_public_key");
  });

  afterEach(() => {
    resetRevenueCatForTests();
    vi.unstubAllEnvs();
  });

  it("devuelve el priceString localizado del paquete mensual, sin tocarlo", async () => {
    const native = mockNative({
      getOfferings: vi.fn().mockResolvedValue({
        current: { monthly: { product: { priceString: "L 124.00", title: " Bible AI Honduras Pro " } } },
      }),
    });
    setRevenueCatNativeForTests(native);

    await expect(getMonthlyOffer("user_clerk_ana")).resolves.toEqual({
      ok: true,
      offer: { priceString: "L 124.00", title: "Bible AI Honduras Pro" },
    });
    expect(native.configure).toHaveBeenCalledWith({ apiKey: "test_public_key", appUserID: "user_clerk_ana" });
  });

  it("sin offering current, sin paquete mensual o sin precio: offering_unavailable", async () => {
    for (const offerings of [{ current: null }, { current: {} }, { current: { monthly: { product: { priceString: "" } } } }]) {
      resetRevenueCatForTests();
      setRevenueCatNativeForTests(mockNative({ getOfferings: vi.fn().mockResolvedValue(offerings) }));
      await expect(getMonthlyOffer()).resolves.toEqual({ ok: false, reason: "offering_unavailable" });
    }
  });

  it("sin red distingue network_error de otros fallos del SDK", async () => {
    setRevenueCatNativeForTests(mockNative({ getOfferings: vi.fn().mockRejectedValue({ code: "10" }) }));
    await expect(getMonthlyOffer()).resolves.toEqual({ ok: false, reason: "network_error" });

    resetRevenueCatForTests();
    setRevenueCatNativeForTests(mockNative({ getOfferings: vi.fn().mockRejectedValue({ code: "23" }) }));
    await expect(getMonthlyOffer()).resolves.toEqual({ ok: false, reason: "offering_unavailable" });
  });

  it("sin key ni módulo nativo no inventa un precio", async () => {
    setRevenueCatNativeForTests(null);
    await expect(getMonthlyOffer()).resolves.toEqual({ ok: false, reason: "dev_build_required" });
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    await expect(getMonthlyOffer()).resolves.toEqual({ ok: false, reason: "not_configured" });
  });

  it("una compra o restauración sin red no desbloquea nada y no lanza", async () => {
    setRevenueCatNativeForTests(mockNative({ purchasePackage: vi.fn().mockRejectedValue({ code: "35" }) }));
    await expect(purchaseMonthly("user_x")).resolves.toEqual({ ok: false, reason: "network_error" });

    resetRevenueCatForTests();
    setRevenueCatNativeForTests(mockNative({ logIn: vi.fn().mockRejectedValue({ code: "10" }) }));
    await expect(purchaseMonthly("user_x")).resolves.toEqual({ ok: false, reason: "network_error" });
    await expect(restorePurchases("user_x")).resolves.toEqual({ ok: false, reason: "network_error" });
  });
});
