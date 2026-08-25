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
 * Expo Go no incluye el módulo nativo; hace falta un development build.
 * #31 conecta `react-native-purchases`. Hasta entonces este facade no importa
 * el nativo (así `npm test` / typecheck no se rompen).
 */

export const REVENUECAT_PRODUCT = {
  entitlementId: "pro",
  offeringId: "default",
  productId: "pro_monthly",
} as const;

export const REVENUECAT_ENTITLEMENT_ID = REVENUECAT_PRODUCT.entitlementId;
export const REVENUECAT_OFFERING_ID = REVENUECAT_PRODUCT.offeringId;
export const REVENUECAT_TEST_STORE_PRODUCT_ID = REVENUECAT_PRODUCT.productId;

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

export class RevenueCatDevBuildRequiredError extends Error {
  constructor() {
    super(
      "RevenueCat requiere un development build de Expo (no Expo Go). El Test Store no funciona en Expo Go.",
    );
    this.name = "RevenueCatDevBuildRequiredError";
  }
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

// Configura el SDK público. No consulta CustomerInfo y no decide isPro.
export function configure(): string {
  return publicApiKey();
}

// Vincula el App User ID de RevenueCat al clerkId (identity.subject).
export async function logIn(clerkUserId: string): Promise<PurchaseResult> {
  if (!clerkUserId) {
    throw new Error(
      "logIn requiere clerkUserId = Clerk identity.subject (users.clerkId)",
    );
  }
  configure();
  return { ok: false, reason: "dev_build_required" };
}

export async function purchaseMonthly(): Promise<PurchaseResult> {
  configure();
  return { ok: false, reason: "dev_build_required" };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  configure();
  return { ok: false, reason: "dev_build_required" };
}
