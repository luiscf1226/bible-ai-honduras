import { v } from "convex/values";

import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { generateStructuredAnswer } from "./llm";
import {
  buildQaUserPrompt,
  formatCitation,
  NO_RELEVANT_CONTENT_ANSWER,
  QA_RESPONSE_SCHEMA,
  QA_SYSTEM_PROMPT,
  type QaResponse,
} from "./prompts/qa";
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
// encontró nada en vez de fabricar una cita; y si el modelo cita algo que
// no se le dio como contexto, esa respuesta nunca llega al usuario.
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
    const structured = await generateStructuredAnswer({
      system: QA_SYSTEM_PROMPT,
      userPrompt: buildQaUserPrompt(args.question, citations),
      schema: QA_RESPONSE_SCHEMA,
    });

    if (!isGrounded(structured, citations)) {
      return { answer: buildFallbackAnswer(primary), citation: toCitation(primary) };
    }

    return { answer: structured.answer, citation: toCitation(primary) };
  },
});

function toCitation(verse: RetrievedVerse): Citation {
  return {
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    version: verse.version,
    text: verse.text,
  };
}

// Verificación de cita: cada referencia que el modelo devuelve en
// `citations` tiene que ser exactamente una de las que se le dieron como
// contexto. Estructural, no depende de parsear la prosa de la respuesta
// (ARCHITECTURE.md §5.1.2 — "hace verificable el paso 8 sin parsear texto").
// Exportada para que Voces (#18) y Sentimiento (#28) la reusen cuando
// copien este patrón, en vez de reimplementarla cada uno.
export function isGrounded(structured: QaResponse, retrieved: RetrievedVerse[]): boolean {
  if (structured.citations.length === 0) {
    return false;
  }
  const allowed = new Set(retrieved.map((verse) => referenceKey(verse)));
  return structured.citations.every((citation) => allowed.has(referenceKey(citation)));
}

function referenceKey(ref: { book: string; chapter: number; verse: number; version: string }): string {
  return `${ref.version}|${ref.book}|${ref.chapter}|${ref.verse}`;
}

function buildFallbackAnswer(verse: RetrievedVerse): string {
  return `"${verse.text}"\n\n${formatCitation(verse)}`;
}

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
