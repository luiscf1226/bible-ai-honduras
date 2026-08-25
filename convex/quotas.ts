import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { hondurasDateKey } from "./devotional";
import { entitlementIsActive } from "./entitlements";

const moduleValidator = v.union(
  v.literal("qa"),
  v.literal("voices"),
  v.literal("feelings"),
  v.literal("stories"),
);

export type QuotaModule = "qa" | "voices" | "feelings" | "stories";

export const QUOTA_LIMITS: Record<QuotaModule, number> = {
  qa: 5,
  voices: 5,
  feelings: 3,
  stories: 1,
};

export const LIMITS = QUOTA_LIMITS;

const STORIES_DAY_KEY = "lifetime";

function dayKey(module: QuotaModule, now = Date.now()): string {
  return module === "stories" ? STORIES_DAY_KEY : hondurasDateKey(now);
}

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

async function isUserPro(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<boolean> {
  const row = await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return entitlementIsActive(row);
}

async function consume(ctx: MutationCtx, userId: Id<"users">, module: QuotaModule) {
  if (await isUserPro(ctx, userId)) {
    return { allowed: true as const };
  }

  const limit = LIMITS[module];
  const day = dayKey(module);
  const row = await usageRow(ctx, userId, module, day);
  if ((row?.count ?? 0) >= limit) {
    return { allowed: false as const, reason: "limit_reached" as const, module };
  }

  if (row) {
    await ctx.db.patch(row._id, { count: row.count + 1 });
  } else {
    await ctx.db.insert("usage", { userId, module, day, count: 1 });
  }
  return { allowed: true as const };
}

async function remainingFor(ctx: QueryCtx, userId: Id<"users">, module: QuotaModule) {
  const isPro = await isUserPro(ctx, userId);
  const limit = QUOTA_LIMITS[module];
  const row = await usageRow(ctx, userId, module, dayKey(module));
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
