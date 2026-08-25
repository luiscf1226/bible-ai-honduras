import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";

import { api } from "./_generated/api";
import { action, mutation } from "./_generated/server";
import type { QuotaModule } from "./quotas";

const MAX_FEELINGS = 4;
const MAX_NOTE_LENGTH = 600;

type FeelingInput = {
  feelings: string[];
  note?: string;
};

const devotionalValidator = v.object({
  title: v.string(),
  reflection: v.string(),
  prayer: v.string(),
  citation: v.object({
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    version: v.string(),
    text: v.string(),
  }),
});

type FeelingDevotional = {
  title: string;
  reflection: string;
  prayer: string;
  citation: { book: string; chapter: number; verse: number; version: string; text: string };
};

const saveGeneratedDevotional = makeFunctionReference<
  "mutation",
  { prompt: string; devotional: FeelingDevotional },
  string
>("feelings:saveGenerated");

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

// La action nunca escribe directo en la base. Esta mutation reutiliza las
// tablas `conversations`/`messages` que History ya lista y borra para los tres
// módulos, y deriva el usuario de la sesión en vez de aceptar un userId.
export const saveGenerated = mutation({
  args: { prompt: v.string(), devotional: devotionalValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("No autenticado");
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");

    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      module: "feelings",
      createdAt: Date.now(),
    });
    await ctx.db.insert("messages", { conversationId, role: "user", text: args.prompt });
    await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      text: args.devotional.reflection,
      devotional: args.devotional,
    });
    return conversationId;
  },
});

type GenerateResult =
  | { allowed: false; reason: "limit_reached"; module: QuotaModule }
  | { allowed: true; conversationId: string; devotional: FeelingDevotional };

// Este módulo no llama a Anthropic ni a Voyage: reutiliza el pipeline RAG de
// rag.answer. Si no hay una cita recuperada, no devolvemos un devocional que
// parezca una opinión libre.
//
// El return type está anotado a mano (no inferido): sin esto, TS entra en
// una referencia circular al resolver `api` (esta acción llama a
// `ctx.runAction(api.rag.answer.ask, ...)`, que forma parte del mismo `api`
// que depende de resolver el tipo de esta acción) y termina marcando como
// `any` código sin relación en todo el proyecto (retrieve.ts, componentes
// de voces/sentir, etc.) — visto al mergear master con la corrección de
// citación de rag/answer.ts.
export const generate = action({
  args: {
    feelings: v.array(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GenerateResult> => {
    normalizedInput(args);
    const user = await ctx.runQuery(api.users.current, {});
    if (!user) {
      throw new ConvexError("No autenticado");
    }

    // Se consume antes de llamar a rag.answer (y por lo tanto antes de gastar
    // embeddings/LLM). Pro queda permitido por el servicio único de cuotas.
    const quota = await ctx.runMutation(api.quotas.checkAndConsume, { module: "feelings" });
    if (!quota.allowed) return quota;

    const result = await ctx.runAction(api.rag.answer.ask, {
      question: buildFeelingQuestion(args),
      version: user.bibleVersion,
    });

    if (!result.citation) {
      throw new ConvexError("No encontramos un pasaje bíblico para acompañarte ahora. Intentá con otras palabras.");
    }

    // `result.citation` incluye `verseId` (agregado en #14 para la tarjeta de
    // cita de Q&A) — devotionalValidator no lo espera, se descarta acá.
    const { verseId: _verseId, ...citation } = result.citation;
    const devotional = {
      citation,
      prayer: prayerForFeeling(args),
      reflection: result.answer,
      title: titleForFeeling(args),
    };
    const conversationId = await ctx.runMutation(saveGeneratedDevotional, {
      prompt: buildFeelingQuestion(args),
      devotional,
    });

    return { allowed: true as const, conversationId, devotional };
  },
});
