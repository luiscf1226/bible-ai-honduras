import { resolveBibleVersion } from "../bibleVersions";
import { ConvexError, v } from "convex/values";

import type { QueryCtx } from "../_generated/server";
import { internalMutation, query } from "../_generated/server";
import { EMBEDDING_DIMENSIONS } from "./embed";

const DEFAULT_VERSION = "RVR1960";

async function findVerse(
  ctx: QueryCtx,
  args: { version: string; book: string; chapter: number; verse: number },
) {
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
}

async function bibleVersionForIdentity(ctx: QueryCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return DEFAULT_VERSION;
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  // #93 §4b: una preferencia sin corpus (NVI) degrada a RVR1960.
  return resolveBibleVersion(user?.bibleVersion);
}

// Consulta pública por referencia exacta. No expone el embedding.
export const getByRef = query({
  args: {
    version: v.string(),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
  },
  handler: async (ctx, args) => findVerse(ctx, args),
});

// La versión sale de `users.bibleVersion` (RVR1960 por defecto). Si el usuario
// eligió NVI y ese versículo no está ingerido, `verse` es null — no se inventa
// texto. El caller muestra la versión preferida igual.
export const citedForUser = query({
  args: {
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
  },
  handler: async (ctx, args) => {
    const version = await bibleVersionForIdentity(ctx);
    const verse = await findVerse(ctx, { ...args, version });
    return { version, verse };
  },
});

// Versículos indexados de un capítulo, para el paso 3 del selector de
// pasaje (#12). Si el corpus todavía no ingirió ese capítulo, devuelve []
// — el picker deja avanzar igual sin versículo puntual, no bloquea.
export const listByChapter = query({
  args: {
    version: v.string(),
    book: v.string(),
    chapter: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) => q.eq("version", args.version).eq("book", args.book).eq("chapter", args.chapter))
      .collect();

    return rows
      .map((row) => ({ book: row.book, chapter: row.chapter, verse: row.verse, version: row.version, text: row.text }))
      .sort((a, b) => a.verse - b.verse);
  },
});

// Consulta pública por id (usada tras un vectorSearch, que solo devuelve
// _id + _score). No expone el embedding.
export const getById = query({
  args: { id: v.id("verses") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) {
      return null;
    }

    return {
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
