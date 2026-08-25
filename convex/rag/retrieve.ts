import { v } from "convex/values";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { embedQuery } from "./embed";

export type RetrievedVerse = {
  _id: Id<"verses">;
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
  score: number;
};

const DEFAULT_VERSION = "RVR1960";
const DEFAULT_LIMIT = 3;

// Umbral conservador de similitud coseno: por debajo de esto tratamos la
// coincidencia como irrelevante y no fabricamos una cita (regla dura #4).
export const RELEVANCE_THRESHOLD = 0.3;

// Función plana (no un `action` registrado) para que `answer.ts` la llame
// directo, sin un viaje de red extra vía `ctx.runAction`.
export async function retrieveTopVerses(
  ctx: ActionCtx,
  args: { query: string; version?: string; limit?: number },
): Promise<RetrievedVerse[]> {
  const version = args.version ?? DEFAULT_VERSION;
  const limit = args.limit ?? DEFAULT_LIMIT;
  const embedding = await embedQuery(args.query);

  const matches = await ctx.vectorSearch("verses", "by_embedding", {
    vector: embedding,
    limit,
    filter: (q) => q.eq("version", version),
  });

  const relevant = matches.filter((match) => match._score >= RELEVANCE_THRESHOLD);
  const verses = await Promise.all(
    relevant.map((match) => ctx.runQuery(api.rag.verses.getById, { id: match._id })),
  );

  const result: RetrievedVerse[] = [];
  verses.forEach((verse, index) => {
    if (verse) {
      result.push({ ...verse, _id: relevant[index]._id, score: relevant[index]._score });
    }
  });
  return result;
}

// Wrapper pública — solo recuperación, sin generar respuesta. Para debug o
// para un consumidor que solo necesite los versículos relevantes.
export const topVerses = action({
  args: { query: v.string(), version: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => retrieveTopVerses(ctx, args),
});
