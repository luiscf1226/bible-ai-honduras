import { ConvexError, v } from "convex/values";

import { internalMutation, query } from "../_generated/server";
import { EMBEDDING_DIMENSIONS } from "./embed";

// Consulta pública por referencia exacta. No expone el embedding.
export const getByRef = query({
  args: {
    version: v.string(),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) =>
        q
          .eq("version", args.version)
          .eq("book", args.book)
          .eq("chapter", args.chapter)
          .eq("verse", args.verse),
      )
      .unique();

    if (!row) {
      return null;
    }

    return {
      _id: row._id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      version: row.version,
      text: row.text,
    };
  },
});

// Idempotente en (version, book, chapter, verse): si existe, parchea texto
// y embedding; si no, inserta. Solo la ingesta (internal) puede escribir.
export const upsertVerse = internalMutation({
  args: {
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    version: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    if (args.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new ConvexError(`embedding debe tener ${EMBEDDING_DIMENSIONS} dimensiones`);
    }

    const existing = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) =>
        q
          .eq("version", args.version)
          .eq("book", args.book)
          .eq("chapter", args.chapter)
          .eq("verse", args.verse),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        text: args.text,
        embedding: args.embedding,
      });
      return existing._id;
    }

    return await ctx.db.insert("verses", args);
  },
});
