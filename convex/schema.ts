import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Clerk es la autoridad de identidad; acá solo espejamos lo que necesitamos.
  users: defineTable({
    clerkId: v.string(), // identity.subject del JWT de Clerk
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    bibleVersion: v.union(v.literal("RVR1960"), v.literal("NVI")),
    reminderHour: v.optional(v.number()),
    darkMode: v.optional(v.boolean()),
    referralCode: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  // Contenido editorial curado. La fecha usa el calendario de Honduras
  // (YYYY-MM-DD), no la zona horaria del dispositivo.
  dailyDevotionals: defineTable({
    date: v.string(),
    catalogId: v.string(),
    verseRef: v.string(),
    reflection: v.string(),
    imageUrl: v.string(),
    imageAlt: v.string(),
    imageAttributionUrl: v.string(),
  }).index("by_date", ["date"]),

  // ── Transversales (#4 / quotas) ─────────────────────────
  usage: defineTable({
    userId: v.id("users"),
    module: v.union(
      v.literal("qa"),
      v.literal("voices"),
      v.literal("feelings"),
      v.literal("stories"),
    ),
    day: v.string(), // "2026-08-18"; use "lifetime" for stories
    count: v.number(),
  }).index("by_user_module_day", ["userId", "module", "day"]),

  entitlements: defineTable({
    userId: v.id("users"),
    isPro: v.boolean(),
    expiresAt: v.optional(v.number()),
    source: v.string(), // "revenuecat_webhook"
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
