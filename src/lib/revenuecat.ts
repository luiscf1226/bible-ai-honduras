/**
 * RevenueCat SDK — compra y restore solamente.
 *
 * Nunca leas CustomerInfo / entitlements.active.pro para decidir isPro.
 * La autoridad es Convex `entitlements.mine` (el webhook escribe esa fila).
 *
 * `app_user_id` DEBE ser el Clerk `identity.subject` — el mismo string que
 * se guarda en `users.clerkId`. El webhook busca al usuario por ese id.
 *
 * Contrato de producto (nombres estables):
 *   entitlement `pro` · offering `default` · Test Store product `pro_monthly`
 * El precio USD 4.99 / 1 mes vive en RevenueCat, no en este módulo ni en UI.
 *
 * Expo Go y web no completan una compra real. Hace falta un development build.
 */

export const REVENUECAT_PRODUCT = {
  entitlementId: "pro",
  offeringId: "default",
  productId: "pro_monthly",
} as const;

export const REVENUECAT_ENTITLEMENT_ID = REVENUECAT_PRODUCT.entitlementId;
export const REVENUECAT_OFFERING_ID = REVENUECAT_PRODUCT.offeringId;
export const REVENUECAT_TEST_STORE_PRODUCT_ID = REVENUECAT_PRODUCT.productId;

export type PurchaseResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "dev_build_required"
        | "user_cancelled"
        | "offering_unavailable"
        | "purchase_failed";
    };

export class RevenueCatDevBuildRequiredError extends Error {
  constructor() {
    super(
      "RevenueCat requiere un development build de Expo (no Expo Go). El Test Store no funciona en Expo Go.",
    );
    this.name = "RevenueCatDevBuildRequiredError";
  }
}

export type RevenueCatNative = {
  configure: (config: { apiKey: string; appUserID?: string }) => unknown;
  logIn: (appUserID: string) => Promise<unknown>;
  getOfferings: () => Promise<{ current?: { monthly?: unknown } | null }>;
  purchasePackage: (pkg: unknown) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
};

type NativeOverride = RevenueCatNative | null | undefined;

let nativeOverride: NativeOverride;
let configured = false;

export function setRevenueCatNativeForTests(native: NativeOverride): void {
  nativeOverride = native;
  configured = false;
}

export function resetRevenueCatForTests(): void {
  nativeOverride = undefined;
  configured = false;
}

/**
 * Beta sin RevenueCat (#93): sin la key pública no hay compra posible.
 * La UI debe *ocultar* el CTA, no dejarlo romper — Apple rechaza builds que
 * muestran precio sin IAP funcional. `isPro` lo sigue mandando Convex
 * `entitlements.mine`, así que un Pro otorgado a mano funciona igual.
 */
export function purchasesConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY);
}

function publicApiKey(): string {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (!key) {
    throw new Error(
      "Falta EXPO_PUBLIC_REVENUECAT_API_KEY. Copiá .env.example a .env.local.",
    );
  }
  return key;
}

function isStoreClient(executionEnvironment: string | null | undefined): boolean {
  return executionEnvironment === "storeClient";
}

async function loadNative(): Promise<RevenueCatNative | null> {
  if (nativeOverride !== undefined) {
    return nativeOverride;
  }

  try {
    const { Platform } = await import("react-native");
    if (Platform.OS === "web") {
      return null;
    }
    const Constants = (await import("expo-constants")).default;
    if (isStoreClient(Constants.executionEnvironment)) {
      return null;
    }
    const mod = await import("react-native-purchases");
    return mod.default as unknown as RevenueCatNative;
  } catch {
    return null;
  }
}

async function ensureConfigured(native: RevenueCatNative, clerkUserId?: string): Promise<void> {
  if (configured) {
    return;
  }
  native.configure({
    apiKey: publicApiKey(),
    appUserID: clerkUserId,
  });
  configured = true;
}

function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    (error as { userCancelled?: boolean }).userCancelled === true
  );
}

export function configure(): string {
  return publicApiKey();
}

export async function logIn(clerkUserId: string): Promise<PurchaseResult> {
  if (!clerkUserId) {
    throw new Error(
      "logIn requiere clerkUserId = Clerk identity.subject (users.clerkId)",
    );
  }
  if (!purchasesConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  const native = await loadNative();
  if (!native) {
    return { ok: false, reason: "dev_build_required" };
  }
  await ensureConfigured(native, clerkUserId);
  await native.logIn(clerkUserId);
  return { ok: true };
}

export async function purchaseMonthly(clerkUserId?: string): Promise<PurchaseResult> {
  if (!purchasesConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  const native = await loadNative();
  if (!native) {
    return { ok: false, reason: "dev_build_required" };
  }
  if (clerkUserId) {
    const identified = await logIn(clerkUserId);
    if (!identified.ok) {
      return identified;
    }
  } else {
    await ensureConfigured(native);
  }

  try {
    const offerings = await native.getOfferings();
    const monthly = offerings.current?.monthly;
    if (!monthly) {
      return { ok: false, reason: "offering_unavailable" };
    }
    await native.purchasePackage(monthly);
    return { ok: true };
  } catch (error) {
    if (isUserCancelled(error)) {
      return { ok: false, reason: "user_cancelled" };
    }
    return { ok: false, reason: "purchase_failed" };
  }
}

export async function restorePurchases(clerkUserId?: string): Promise<PurchaseResult> {
  if (!purchasesConfigured()) {
    return { ok: false, reason: "not_configured" };
  }
  const native = await loadNative();
  if (!native) {
    return { ok: false, reason: "dev_build_required" };
  }
  if (clerkUserId) {
    const identified = await logIn(clerkUserId);
    if (!identified.ok) {
      return identified;
    }
  } else {
    await ensureConfigured(native);
  }
  try {
    await native.restorePurchases();
    return { ok: true };
  } catch {
    return { ok: false, reason: "purchase_failed" };
  }
}
