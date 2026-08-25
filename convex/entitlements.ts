import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";

export const PRO_ENTITLEMENT_ID = "pro";
export const ENTITLEMENT_SOURCE = "revenuecat_webhook";
// Beta sin RevenueCat (#93). Queda en `source` para distinguir un Pro de
// cortesía de uno comprado — no borrar filas con este origen al migrar.
export const BETA_ENTITLEMENT_SOURCE = "beta_manual";

const GRANT_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);

// Eventos que siempre revocan Pro, aunque `entitlement_ids` todavía liste "pro".
const REVOKE_EVENT_TYPES = new Set(["EXPIRATION"]);

export type ProStatus = {
  isPro: boolean;
  expiresAt?: number;
};

async function findByClerkId(ctx: QueryCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

function isExpired(expiresAt: number | undefined, now: number): boolean {
  return expiresAt !== undefined && expiresAt <= now;
}

// Pro activo = fila isPro y todavía no venció. Sin fila → free.
export function entitlementIsActive(
  row: { isPro: boolean; expiresAt?: number } | null,
  now = Date.now(),
): boolean {
  if (!row?.isPro) {
    return false;
  }
  return !isExpired(row.expiresAt, now);
}

export async function getEntitlementForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ProStatus | null> {
  const row = await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!row) {
    return null;
  }
  return {
    isPro: entitlementIsActive(row),
    expiresAt: row.expiresAt,
  };
}

// Desbloquea Pro solo si el evento trae el entitlement `pro`. EXPIRATION
// siempre lo apaga. El resto (p. ej. CANCELLATION con `pro` todavía activo)
// sigue el array `entitlement_ids`.
export function proStatusFromEvent(
  type: string,
  entitlementIds: ReadonlyArray<string> | null | undefined,
): { isPro: boolean } {
  const hasPro = Array.isArray(entitlementIds) && entitlementIds.includes(PRO_ENTITLEMENT_ID);
  if (REVOKE_EVENT_TYPES.has(type)) {
    return { isPro: false };
  }
  if (GRANT_EVENT_TYPES.has(type)) {
    return { isPro: hasPro };
  }
  return { isPro: hasPro };
}

export type RevenueCatEvent = {
  type: string;
  appUserId: string;
  entitlementIds: string[] | null;
  expirationAtMs?: number;
};

export function parseRevenueCatEvent(body: unknown): RevenueCatEvent | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const event = (body as { event?: unknown }).event;
  if (typeof event !== "object" || event === null) {
    return null;
  }
  const record = event as Record<string, unknown>;
  if (typeof record.type !== "string" || typeof record.app_user_id !== "string") {
    return null;
  }
  const rawIds = record.entitlement_ids;
  let entitlementIds: string[] | null = null;
  if (Array.isArray(rawIds)) {
    entitlementIds = rawIds.filter((id): id is string => typeof id === "string");
  }
  const expirationAtMs =
    typeof record.expiration_at_ms === "number" ? record.expiration_at_ms : undefined;
  return {
    type: record.type,
    appUserId: record.app_user_id,
    entitlementIds,
    expirationAtMs,
  };
}

// Comparación en tiempo constante del header Authorization que manda
// RevenueCat (Bearer <secret> o el valor exacto configurado en el dashboard).
export function authorizationHeaderIsValid(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!header || !secret) {
    return false;
  }
  const expected = secret.startsWith("Bearer ") ? secret : `Bearer ${secret}`;
  return timingSafeEqual(header, expected) || timingSafeEqual(header, secret);
}

function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const len = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    mismatch |= av ^ bv;
  }
  return mismatch === 0;
}

// Extraído para tests: el httpAction solo lee process.env y delega acá.
export async function handleRevenueCatWebhook(
  ctx: Pick<GenericActionCtx<DataModel>, "runMutation">,
  request: Request,
  secret: string | undefined,
): Promise<Response> {
  if (!authorizationHeaderIsValid(request.headers.get("Authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event = parseRevenueCatEvent(body);
  if (!event) {
    return new Response("Bad Request", { status: 400 });
  }

  const { isPro } = proStatusFromEvent(event.type, event.entitlementIds);
  await ctx.runMutation(internal.entitlements.upsertFromWebhook, {
    clerkId: event.appUserId,
    isPro,
    expiresAt: event.expirationAtMs,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function findEntitlementByUser(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function upsertEntitlement(
  ctx: MutationCtx,
  args: { userId: Id<"users">; isPro: boolean; expiresAt?: number; source?: string },
) {
  const existing = await findEntitlementByUser(ctx, args.userId);
  const updatedAt = Date.now();
  const source = args.source ?? ENTITLEMENT_SOURCE;
  if (existing) {
    await ctx.db.patch(existing._id, {
      isPro: args.isPro,
      expiresAt: args.expiresAt,
      source,
      updatedAt,
    });
    return existing._id;
  }
  return await ctx.db.insert("entitlements", {
    userId: args.userId,
    isPro: args.isPro,
    expiresAt: args.expiresAt,
    source,
    updatedAt,
  });
}

// Lo llama el webhook. `clerkId` = RevenueCat `app_user_id` = Clerk subject.
// Si el usuario todavía no corrió users.upsert, se ignora (200) — no creamos
// filas de users desde RevenueCat.
export const upsertFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    isPro: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await findByClerkId(ctx, args.clerkId);
    if (!user) {
      return { ignored: true as const };
    }
    await upsertEntitlement(ctx, {
      userId: user._id,
      isPro: args.isPro,
      expiresAt: args.expiresAt,
    });
    return { ignored: false as const, userId: user._id };
  },
});

/**
 * Otorga (o revoca) Pro a mano para la beta cerrada — #93.
 *
 * La autoridad de `isPro` es esta tabla, no el SDK de RevenueCat, así que una
 * fila escrita acá desbloquea los 4 módulos igual que una compra real (#32).
 *
 * `internalMutation`: no se puede llamar desde la app, solo desde el dashboard
 * de Convex o `npx convex run`. Un tester no puede auto-otorgarse Pro.
 *
 *   npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc..."}'
 *   npx convex run entitlements:grantProForBeta '{"clerkId":"user_2abc...","isPro":false}'
 *
 * El tester tiene que haber entrado al menos una vez (users.upsert) — si no,
 * devuelve `ignored` en vez de crear la fila de users, igual que el webhook.
 */
export const grantProForBeta = internalMutation({
  args: {
    clerkId: v.string(),
    isPro: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await findByClerkId(ctx, args.clerkId);
    if (!user) {
      return { ignored: true as const };
    }
    const isPro = args.isPro ?? true;
    await upsertEntitlement(ctx, {
      userId: user._id,
      isPro,
      expiresAt: args.expiresAt,
      source: BETA_ENTITLEMENT_SOURCE,
    });
    return { ignored: false as const, userId: user._id, isPro };
  },
});

// `{ isPro, expiresAt } | null`. null = sin sesión o sin fila → tratar como free.
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await findByClerkId(ctx, identity.subject);
    if (!user) {
      return null;
    }
    const row = await findEntitlementByUser(ctx, user._id);
    if (!row) {
      return null;
    }
    return {
      isPro: entitlementIsActive(row),
      expiresAt: row.expiresAt,
    };
  },
});
