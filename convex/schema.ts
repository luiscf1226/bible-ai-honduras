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

  // ── RAG (#5) ────────────────────────────────────────────
  verses: defineTable({
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    version: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()), // voyage-4 → 1024 dims
  })
    .index("by_ref", ["version", "book", "chapter", "verse"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
      filterFields: ["version", "book"],
    }),

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

  // Historial compartido (Voces, Q&A, Sentimiento). #35 borra estas filas
  // de verdad — no hay `deleted: true`.
  conversations: defineTable({
    userId: v.id("users"),
    module: v.union(v.literal("qa"), v.literal("voices"), v.literal("feelings")),
    characterId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_module", ["userId", "module"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    devotional: v.optional(
      v.object({
        title: v.string(),
        reflection: v.string(),
        prayer: v.string(),
        citation: v.object({
          book: v.string(),
          chapter: v.number(),
          verse: v.number(),
          version: v.string(),
          text: v.string(),
        }),
      }),
    ),
    citations: v.optional(
      v.array(
        v.object({
          book: v.string(),
          chapter: v.number(),
          verse: v.number(),
          version: v.string(),
          verseId: v.id("verses"),
        }),
      ),
    ),
  }).index("by_conversation", ["conversationId"]),

  stories: defineTable({
    userId: v.id("users"),
    catalogId: v.string(),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    scenes: v.array(v.object({
      id: v.string(),
      order: v.number(),
      title: v.string(),
      narration: v.string(),
      reference: v.string(),
      status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
      storageId: v.optional(v.id("_storage")),
    })),
    createdAt: v.number(),
  }).index("by_user_catalog", ["userId", "catalogId"]),
});
