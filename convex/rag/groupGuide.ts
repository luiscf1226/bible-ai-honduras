import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import type { Citation } from "./answer";
import { retrieveCommentary } from "./commentary";
import { generateStructuredAnswer } from "./llm";
import {
  buildGroupGuideUserPrompt,
  GROUP_GUIDE_RESPONSE_SCHEMA,
  GROUP_GUIDE_SYSTEM_PROMPT,
  GUIDE_MAX_CONTEXT_VERSES,
  GUIDE_MAX_QUESTIONS,
  GUIDE_MIN_QUESTIONS,
  type GroupGuideResponse,
} from "./prompts/groupGuide";

/**
 * "Preparar para mi grupo" (#188). Mismo pipeline que `rag/answer.ts`:
 *
 * 1. Recuperación: los versículos indexados del capítulo (no hace falta
 *    búsqueda semántica: el pasaje es explícito, como `passage` en `ask`).
 * 2. Comentario de referencia: `retrieveCommentary`, igual que Preguntar.
 * 3. Generación con salida estructurada (`generateStructuredAnswer`).
 * 4. Verificación de citas: cada cita tiene que ser uno de los versículos que
 *    se dieron como contexto. Una pregunta sin cita verificable se descarta;
 *    si el resumen no tiene cita o quedan menos de 4 preguntas, no se entrega
 *    nada (regla dura #4: nunca una guía sin ancla en el texto).
 */

export type GuideItem = { text: string; citations: Citation[] };

export type GroupGuide = {
  book: string;
  chapter: number;
  version: string;
  summary: GuideItem;
  questions: GuideItem[];
  /** El capítulo era más largo que el contexto y la guía cubre solo el inicio. */
  truncatedAtVerse: number | null;
};

export type GroupGuideResult = { status: "ok"; guide: GroupGuide } | { status: "no_content" } | { status: "not_grounded" };

type ContextVerse = Citation;

function referenceKey(ref: { book: string; chapter: number; verse: number; version: string }): string {
  return `${ref.version}|${ref.book}|${ref.chapter}|${ref.verse}`;
}

/**
 * Paso 4, puro y testeable: cruza las citas del modelo con el contexto y
 * devuelve la guía con el texto real de cada versículo, o null si no alcanza.
 */
export function groundGuide(
  structured: GroupGuideResponse,
  context: readonly ContextVerse[],
): { summary: GuideItem; questions: GuideItem[] } | null {
  const byKey = new Map(context.map((verse) => [referenceKey(verse), verse]));
  const resolve = (refs: GroupGuideResponse["summaryCitations"]): Citation[] | null => {
    if (refs.length === 0) return null;
    const resolved: Citation[] = [];
    for (const ref of refs) {
      const verse = byKey.get(referenceKey(ref));
      if (!verse) return null;
      if (!resolved.some((item) => item.verse === verse.verse)) resolved.push(verse);
    }
    return resolved.sort((a, b) => a.verse - b.verse);
  };

  const summaryCitations = resolve(structured.summaryCitations);
  if (!summaryCitations || structured.summary.trim().length === 0) return null;

  const questions: GuideItem[] = [];
  for (const item of structured.questions) {
    const citations = resolve(item.citations);
    if (citations && item.question.trim().length > 0) {
      questions.push({ text: item.question.trim(), citations });
    }
  }
  if (questions.length < GUIDE_MIN_QUESTIONS) return null;

  return {
    summary: { text: structured.summary.trim(), citations: summaryCitations },
    questions: questions.slice(0, GUIDE_MAX_QUESTIONS),
  };
}

/** Versículos del capítulo con su id, para poder citarlos. */
export const chapterContext = internalQuery({
  args: { version: v.string(), book: v.string(), chapter: v.number() },
  handler: async (ctx, args): Promise<ContextVerse[]> => {
    const rows = await ctx.db
      .query("verses")
      .withIndex("by_ref", (q) => q.eq("version", args.version).eq("book", args.book).eq("chapter", args.chapter))
      .collect();
    return rows
      .map((row) => ({ verseId: row._id, book: row.book, chapter: row.chapter, verse: row.verse, version: row.version, text: row.text }))
      .sort((a, b) => a.verse - b.verse);
  },
});

export const prepare = internalAction({
  args: { book: v.string(), chapter: v.number(), version: v.string() },
  handler: async (ctx, args): Promise<GroupGuideResult> => {
    const all = await ctx.runQuery(internal.rag.groupGuide.chapterContext, args);
    if (all.length === 0) {
      return { status: "no_content" };
    }
    const context = all.slice(0, GUIDE_MAX_CONTEXT_VERSES);
    const commentary = await retrieveCommentary(ctx, { query: `${args.book} ${args.chapter}`, book: args.book });
    const structured = await generateStructuredAnswer({
      system: GROUP_GUIDE_SYSTEM_PROMPT,
      userPrompt: buildGroupGuideUserPrompt(args, context, commentary),
      schema: GROUP_GUIDE_RESPONSE_SCHEMA,
    });

    const grounded = groundGuide(structured, context);
    if (!grounded) {
      return { status: "not_grounded" };
    }
    return {
      status: "ok",
      guide: {
        book: args.book,
        chapter: args.chapter,
        version: args.version,
        ...grounded,
        truncatedAtVerse: all.length > context.length ? context[context.length - 1]?.verse ?? null : null,
      },
    };
  },
});
