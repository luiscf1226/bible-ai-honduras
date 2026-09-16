import { v } from "convex/values";

import { query } from "./_generated/server";
import {
  findTextStoryById,
  summarizeTextStory,
  TEXT_STORY_CATALOG,
  type TextStoryListItem,
} from "./textStoriesCatalog";

/**
 * API pública del catálogo de historias en texto (#145).
 * Solo lectura, sin auth ni cuota: leer la Biblia en narrativa es gratis.
 */

/** Solo metadatos: el cuerpo de las páginas lo sirve `getById`. */
export const list = query({
  args: {},
  handler: (): TextStoryListItem[] => TEXT_STORY_CATALOG.map(summarizeTextStory),
});

export const getById = query({
  args: { storyId: v.string() },
  handler: (_ctx, args) => findTextStoryById(args.storyId),
});
