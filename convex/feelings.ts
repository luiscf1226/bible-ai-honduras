import { ConvexError, v } from "convex/values";

import { api } from "./_generated/api";
import { action } from "./_generated/server";

const MAX_FEELINGS = 4;
const MAX_NOTE_LENGTH = 600;

type FeelingInput = {
  feelings: string[];
  note?: string;
};

function normalizedInput({ feelings, note }: FeelingInput) {
  const selected = feelings
    .map((feeling) => feeling.trim())
    .filter(Boolean)
    .slice(0, MAX_FEELINGS);
  const personalNote = note?.trim().slice(0, MAX_NOTE_LENGTH) ?? "";

  if (selected.length === 0 && !personalNote) {
    throw new ConvexError("Elegí un sentimiento o contá brevemente cómo estás.");
  }

  return { personalNote, selected };
}

export function buildFeelingQuestion(input: FeelingInput) {
  const { personalNote, selected } = normalizedInput(input);
  const parts = [
    selected.length > 0 ? `La persona identifica: ${selected.join(", ")}.` : "",
    personalNote ? `También cuenta: ${personalNote}` : "",
  ].filter(Boolean);

  return [
    parts.join(" "),
    "Respondé con un devocional breve, compasivo y práctico, basado solo en el pasaje bíblico recuperado.",
  ].join(" ");
}

export function titleForFeeling(input: FeelingInput) {
  const { selected } = normalizedInput(input);
  return selected.length > 0 ? `Para ${selected.slice(0, 2).join(" y ").toLowerCase()}` : "Para este momento";
}

export function prayerForFeeling(input: FeelingInput) {
  const { personalNote, selected } = normalizedInput(input);
  const context = selected[0]?.toLowerCase() ?? (personalNote ? "lo que estoy viviendo" : "este momento");
  return `Señor, acompáñame en medio de ${context}. Ayúdame a descansar en tu cuidado y a dar el siguiente paso hoy. Amén.`;
}

// Este módulo no llama a Anthropic ni a Voyage: reutiliza el pipeline RAG de
// rag.answer. Si no hay una cita recuperada, no devolvemos un devocional que
// parezca una opinión libre.
export const generate = action({
  args: {
    feelings: v.array(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    normalizedInput(args);
    const user = await ctx.runQuery(api.users.current, {});
    if (!user) {
      throw new ConvexError("No autenticado");
    }

    const result = await ctx.runAction(api.rag.answer.ask, {
      question: buildFeelingQuestion(args),
      version: user.bibleVersion,
    });

    if (!result.citation) {
      throw new ConvexError("No encontramos un pasaje bíblico para acompañarte ahora. Intentá con otras palabras.");
    }

    return {
      citation: result.citation,
      prayer: prayerForFeeling(args),
      reflection: result.answer,
      title: titleForFeeling(args),
    };
  },
});
