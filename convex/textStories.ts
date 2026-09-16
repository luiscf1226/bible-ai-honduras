import { v } from "convex/values";

import { query } from "./_generated/server";
import { findTextStoryById, TEXT_STORY_CATALOG } from "./textStoriesCatalog";

/**
 * API pública del catálogo de historias en texto (#145).
 * Solo lectura, sin auth ni cuota: leer la Biblia en narrativa es gratis.
 */

export const list = query({
  args: {},
  handler: () => TEXT_STORY_CATALOG,
});

export const getById = query({
  args: { storyId: v.string() },
  handler: (_ctx, args) => findTextStoryById(args.storyId),
});
