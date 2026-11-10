import { DEFAULT_BIBLE_VERSION } from "../bibleVersions";
import { v } from "convex/values";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { AiCallError, type AiMeter } from "../adminKit/meter";
import { embedQuery } from "./embed";
import { generateStructuredAnswer } from "./llm";
import {
  buildVerseSuggestionPrompt,
  VERSE_SUGGESTION_SCHEMA,
  VERSE_SUGGESTION_SYSTEM_PROMPT,
} from "./prompts/verseSuggest";

export type RetrievedVerse = {
  _id: Id<"verses">;
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
  score: number;
};

const DEFAULT_VERSION = DEFAULT_BIBLE_VERSION;
const DEFAULT_LIMIT = 3;

// Umbral conservador de similitud coseno: por debajo de esto tratamos la
// coincidencia como irrelevante y no fabricamos una cita (regla dura #4).
export const RELEVANCE_THRESHOLD = 0.3;

// Función plana (no un `action` registrado) para que `answer.ts` la llame
// directo, sin un viaje de red extra vía `ctx.runAction`.
export async function retrieveTopVerses(
  ctx: ActionCtx,
  args: { query: string; version?: string; limit?: number; meter?: AiMeter },
): Promise<RetrievedVerse[]> {
  const version = args.version ?? DEFAULT_VERSION;
  const limit = args.limit ?? DEFAULT_LIMIT;
  let embedding: number[];
  try {
    embedding = await embedQuery(args.query, args.meter);
  } catch (error) {
    // Sin embeddings (OpenAI caído o sin saldo) Preguntar, Sentir y Voces no
    // se caen: se recupera por referencia sugerida.
    if (!(error instanceof AiCallError)) throw error;
    console.warn(`Embeddings no disponibles (${error.kind}); recuperación por referencia sugerida`);
    return suggestedVerses(ctx, { query: args.query, version, limit, meter: args.meter });
  }

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

/**
 * Respaldo de `retrieveTopVerses`: el modelo propone referencias y el texto de
 * cada una sale de la Biblia cargada. Lo que no está en la Biblia se descarta,
 * así que nunca hay una cita sin texto real detrás (regla dura #4).
 */
async function suggestedVerses(
  ctx: ActionCtx,
  args: { query: string; version: string; limit: number; meter?: AiMeter },
): Promise<RetrievedVerse[]> {
  const { references } = await generateStructuredAnswer({
    system: VERSE_SUGGESTION_SYSTEM_PROMPT,
    userPrompt: buildVerseSuggestionPrompt(args.query, args.limit),
    schema: VERSE_SUGGESTION_SCHEMA,
    meter: args.meter,
  });
  const result: RetrievedVerse[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    if (result.length >= args.limit) break;
    const key = `${reference.book}|${reference.chapter}|${reference.verse}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const verse = await ctx.runQuery(api.rag.verses.getByRef, { ...reference, version: args.version });
    // Sin similitud que medir: el orden del modelo es el puntaje.
    if (verse) result.push({ ...verse, score: 1 - result.length / 10 });
  }
  return result;
}

// Wrapper pública — solo recuperación, sin generar respuesta. Para debug o
// para un consumidor que solo necesite los versículos relevantes.
export const topVerses = internalAction({
  args: { query: v.string(), version: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => retrieveTopVerses(ctx, args),
});
