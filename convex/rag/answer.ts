import { v } from "convex/values";

import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { generateAnswer } from "./llm";
import { buildQaUserPrompt, NO_RELEVANT_CONTENT_ANSWER, QA_SYSTEM_PROMPT } from "./prompts/qa";
import { retrieveTopVerses, type RetrievedVerse } from "./retrieve";

export type Citation = {
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
};

export type AskResult = {
  answer: string;
  citation: Citation | null;
};

const passageArg = v.object({
  version: v.string(),
  book: v.string(),
  chapter: v.number(),
  verse: v.number(),
});

// Pregunta (+pasaje opcional) → respuesta citada. Nunca genera una
// respuesta sin una cita real cuando hay contenido bíblico relevante
// disponible (regla dura #4) — si no hay nada relevante, admite que no
// encontró nada en vez de fabricar una cita.
export const ask = action({
  args: {
    question: v.string(),
    passage: v.optional(passageArg),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AskResult> => {
    const citations = args.passage
      ? await resolvePassage(ctx, args.passage)
      : await retrieveTopVerses(ctx, { query: args.question, version: args.version });

    if (citations.length === 0) {
      return { answer: NO_RELEVANT_CONTENT_ANSWER, citation: null };
    }

    const primary = citations[0];
    const answerText = await generateAnswer(QA_SYSTEM_PROMPT, buildQaUserPrompt(args.question, citations));

    return {
      answer: answerText,
      citation: {
        book: primary.book,
        chapter: primary.chapter,
        verse: primary.verse,
        version: primary.version,
        text: primary.text,
      },
    };
  },
});

async function resolvePassage(
  ctx: ActionCtx,
  passage: { version: string; book: string; chapter: number; verse: number },
): Promise<RetrievedVerse[]> {
  const verse = await ctx.runQuery(api.rag.verses.getByRef, passage);
  if (verse) {
    return [{ ...verse, score: 1 }];
  }

  // El pasaje pedido no está indexado — no fabricamos la cita. Como último
  // recurso, intentamos recuperación semántica antes de admitir que no hay
  // contenido relevante.
  return retrieveTopVerses(ctx, {
    query: `${passage.book} ${passage.chapter}:${passage.verse}`,
    version: passage.version,
  });
}
