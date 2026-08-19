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
    referralCode: v.string(),
  }).index("by_clerk_id", ["clerkId"]),
});
