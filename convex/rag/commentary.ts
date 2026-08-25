import { v } from "convex/values";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction, internalMutation, query } from "../_generated/server";
import { embedDocument, embedQuery } from "./embed";
import commentarySample from "./fixtures/commentary.sample.json";

// El corpus real de comentarios evangélicos (ej. Matthew Henry en español)
// se carga desde un archivo local con licencia; no se guarda en git. Esta
// muestra es solo para tests y desarrollo — no es contenido publicado.

export type SampleCommentary = {
  source: string;
  book: string;
  chapter: number;
  text: string;
};

export function loadCommentarySample(): SampleCommentary[] {
  return commentarySample as SampleCommentary[];
}

export type RetrievedCommentary = {
  _id: Id<"commentaries">;
  source: string;
  book: string;
  chapter: number;
  text: string;
  score: number;
};

// Umbral conservador — igual que retrieve.ts: por debajo de esto el
// comentario no es lo bastante relevante como para enriquecer la
// respuesta (regla dura #4, aplicada a la segunda fuente de recuperación).
export const COMMENTARY_RELEVANCE_THRESHOLD = 0.3;
const DEFAULT_LIMIT = 1;

// Consulta pública por id (usada tras un vectorSearch, que solo devuelve
// _id + _score). No expone el embedding.
export const getById = query({
  args: { id: v.id("commentaries") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) {
      return null;
    }
    return { source: row.source, book: row.book, chapter: row.chapter, text: row.text };
  },
});

// Idempotente en (source, book, chapter): si existe, parchea texto y
// embedding; si no, inserta. Solo la ingesta (internal) puede escribir.
export const upsertCommentary = internalMutation({
  args: {
    source: v.string(),
    book: v.string(),
    chapter: v.number(),
    text: v.string(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("commentaries")
      .withIndex("by_ref", (q) => q.eq("source", args.source).eq("book", args.book).eq("chapter", args.chapter))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { text: args.text, embedding: args.embedding });
      return existing._id;
    }
    return await ctx.db.insert("commentaries", args);
  },
});

const commentaryInput = v.object({
  source: v.string(),
  book: v.string(),
  chapter: v.number(),
  text: v.string(),
  embedding: v.optional(v.array(v.float64())),
});

// Action interna: embebe cada comentario como documento (o usa el embedding
// inyectado en tests) y hace upsert.
export const ingestCommentary = internalAction({
  args: { commentaries: v.array(commentaryInput) },
  handler: async (ctx, args) => {
    let upserted = 0;
    for (const item of args.commentaries) {
      const embedding = item.embedding ?? (await embedDocument(item.text));
      await ctx.runMutation(internal.rag.commentary.upsertCommentary, {
        source: item.source,
        book: item.book,
        chapter: item.chapter,
        text: item.text,
        embedding,
      });
      upserted += 1;
    }
    return { upserted };
  },
});

// Función plana (no un `action` registrado) para que `answer.ts` la llame
// directo, igual que `retrieveTopVerses` — mismo patrón, tabla distinta.
// Nunca bloquea el pipeline: si no hay comentario relevante, devuelve [].
export async function retrieveCommentary(
  ctx: ActionCtx,
  args: { query: string; book?: string; limit?: number },
): Promise<RetrievedCommentary[]> {
  const limit = args.limit ?? DEFAULT_LIMIT;
  const embedding = await embedQuery(args.query);
  const book = args.book;

  const matches = await ctx.vectorSearch("commentaries", "by_embedding", {
    vector: embedding,
    limit,
    ...(book ? { filter: (q) => q.eq("book", book) } : {}),
  });

  const relevant = matches.filter((match) => match._score >= COMMENTARY_RELEVANCE_THRESHOLD);
  const rows = await Promise.all(
    relevant.map((match) => ctx.runQuery(api.rag.commentary.getById, { id: match._id })),
  );

  const result: RetrievedCommentary[] = [];
  rows.forEach((row, index) => {
    if (row) {
      result.push({ ...row, _id: relevant[index]._id, score: relevant[index]._score });
    }
  });
  return result;
}

// Wrapper pública — solo recuperación, para debug.
export const topCommentary = action({
  args: { query: v.string(), book: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => retrieveCommentary(ctx, args),
});
