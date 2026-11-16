import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { markActive, markLimitHit } from "./activeDays";
import { hondurasDateKey } from "./devotional";
import { entitlementIsActive } from "./entitlements";
import { QUOTA_LIMITS, type QuotaModule } from "./quotaLimits";

const moduleValidator = v.union(
  v.literal("qa"),
  v.literal("voices"),
  v.literal("feelings"),
  v.literal("stories"),
  v.literal("verseImage"),
);

export { QUOTA_LIMITS, type QuotaModule } from "./quotaLimits";

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("No autenticado");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
  }
  return user;
}

async function usageRow(ctx: QueryCtx | MutationCtx, userId: Id<"users">, module: QuotaModule, day: string) {
  return ctx.db
    .query("usage")
    .withIndex("by_user_module_day", (q) => q.eq("userId", userId).eq("module", module).eq("day", day))
    .unique();
}

async function isUserPro(ctx: QueryCtx | MutationCtx, userId: Id<"users">, now = Date.now()): Promise<boolean> {
  const row = await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return entitlementIsActive(row, now);
}

/**
 * Consume una unidad de cuota dentro de otra mutación (p. ej. reservar un
 * fondo con IA en `verseImage.ts`), para que reservar y descontar sean
 * atómicos. Sigue siendo este servicio el que decide.
 */
export async function consume(ctx: MutationCtx, userId: Id<"users">, module: QuotaModule) {
  const result = await charge(ctx, userId, module);
  return result.allowed ? { allowed: true as const } : result;
}

/**
 * Cobra un uso del día de Honduras: el contador se reinicia solo a medianoche
 * de Tegucigalpa porque cada día es otra fila. Pro no tiene límite, pero su uso
 * también se cuenta (métricas por función). Cuando una cuenta gratis gasta su
 * último uso del día, o intenta pasarse, queda marcada como "llegó al límite"
 * (la app deja de llamar en cuanto ve 0, así que el rechazo casi nunca llega).
 * Devuelve el día cobrado para `refund`.
 */
export async function charge(ctx: MutationCtx, userId: Id<"users">, module: QuotaModule) {
  const now = Date.now();
  const user = await ctx.db.get(userId);
  if (user) await markActive(ctx, user, now);

  const day = hondurasDateKey(now);
  const limit = QUOTA_LIMITS[module];
  const row = await usageRow(ctx, userId, module, day);
  const used = row?.count ?? 0;
  const free = !(await isUserPro(ctx, userId, now));
  if (free && used >= limit) {
    if (!row) await ctx.db.insert("usage", { userId, module, day, count: 0, limitHit: true });
    else if (!row.limitHit) await ctx.db.patch(row._id, { limitHit: true });
    if (user) await markLimitHit(ctx, user, day);
    return { allowed: false as const, reason: "limit_reached" as const, module };
  }

  const limitHit = free && used + 1 >= limit ? { limitHit: true } : {};
  if (row) await ctx.db.patch(row._id, { count: used + 1, ...limitHit });
  else await ctx.db.insert("usage", { userId, module, day, count: 1, ...limitHit });
  if (limitHit.limitHit && user) await markLimitHit(ctx, user, day);
  return { allowed: true as const, day };
}

/**
 * Devuelve una unidad cuando lo que se pagó con ella no llegó (el proveedor
 * de IA falló): un error de OpenAI no le gasta el día a la persona. Devuelve
 * al día en que se cobró (`consume` lo informa), aunque la falla llegue pasada
 * la medianoche.
 */
export async function refund(ctx: MutationCtx, userId: Id<"users">, module: QuotaModule, day: string) {
  const row = await usageRow(ctx, userId, module, day);
  if (!row || row.count === 0) return;
  const count = row.count - 1;
  // Si el uso devuelto era el último, la cuenta todavía no llegó al límite.
  await ctx.db.patch(row._id, count < QUOTA_LIMITS[module] ? { count, limitHit: undefined } : { count });
}

async function remainingFor(ctx: QueryCtx, userId: Id<"users">, module: QuotaModule) {
  const isPro = await isUserPro(ctx, userId);
  const limit = QUOTA_LIMITS[module];
  const row = await usageRow(ctx, userId, module, hondurasDateKey());
  const used = row?.count ?? 0;
  if (isPro) {
    return { used, limit, remaining: limit, isPro: true };
  }
  return { used, limit, remaining: Math.max(0, limit - used), isPro: false };
}

export const checkAndConsumeForUser = internalMutation({
  args: {
    userId: v.id("users"),
    module: moduleValidator,
  },
  handler: async (ctx, args) => consume(ctx, args.userId, args.module),
});

export const checkAndConsume = mutation({
  args: { module: moduleValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return consume(ctx, user._id, args.module);
  },
});

export const remaining = query({
  args: { module: moduleValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return remainingFor(ctx, user._id, args.module);
  },
});
