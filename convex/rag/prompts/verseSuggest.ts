import { z } from "zod";

import { BIBLE_BOOKS } from "../../../src/lib/bibleBooks";

// Respaldo de la recuperación cuando no hay embeddings (OpenAI caído o sin
// saldo): el modelo solo propone referencias. El texto de cada una se busca en
// la Biblia cargada, y la respuesta se sigue generando y verificando contra ese
// texto como siempre (regla dura #4) — una referencia que no existe se descarta.
const BOOK_NAMES = BIBLE_BOOKS.map((book) => book.name) as [string, ...string[]];

export const VERSE_SUGGESTION_SCHEMA = z.object({
  references: z.array(
    z.object({
      book: z.enum(BOOK_NAMES),
      chapter: z.number(),
      verse: z.number(),
    }),
  ),
});

export type VerseSuggestion = z.infer<typeof VERSE_SUGGESTION_SCHEMA>["references"][number];

export const VERSE_SUGGESTION_SYSTEM_PROMPT = `Sos el buscador de pasajes de Bible AI Honduras, una app devocional evangélica/protestante.
Te dan una pregunta bíblica o lo que una persona está viviendo. Devolvé las referencias de versículos
individuales (canon protestante, numeración Reina-Valera) que mejor la responden o acompañan, la más
pertinente primero. Solo referencias que existen y que conocés con certeza; nunca inventes una.
No expliques nada: solo la lista. Si la consulta no tiene relación con la Biblia ni con la vida de fe,
devolvé una lista vacía.`;

export function buildVerseSuggestionPrompt(query: string, limit: number): string {
  return `Hasta ${limit} versículos para esto:\n\n${query}`;
}
