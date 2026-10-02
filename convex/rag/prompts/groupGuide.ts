import { z } from "zod";

import { buildQaUserPrompt, QA_CITATION_SCHEMA, type CommentaryContext, type VerseContext } from "./qa";

/**
 * "Preparar para mi grupo" (#188): una variante de Preguntar, no generación
 * libre. Mismo pipeline (versículos recuperados + comentario de referencia +
 * salida estructurada + verificación de citas), mismo contexto
 * (`buildQaUserPrompt`) y mismas reglas del system prompt de Q&A. Lo único que
 * cambia es la forma de la salida: un resumen y 4–5 preguntas, cada pieza con
 * sus citas.
 */

export const GUIDE_MIN_QUESTIONS = 4;
export const GUIDE_MAX_QUESTIONS = 5;

/**
 * Tope de versículos que viajan como contexto. Casi todos los capítulos entran
 * completos; Salmos 119 (176) se recorta a los primeros, y la guía lo dice.
 */
export const GUIDE_MAX_CONTEXT_VERSES = 60;

export const GROUP_GUIDE_RESPONSE_SCHEMA = z.object({
  summary: z.string(),
  summaryCitations: z.array(QA_CITATION_SCHEMA),
  questions: z.array(
    z.object({
      question: z.string(),
      citations: z.array(QA_CITATION_SCHEMA),
    }),
  ),
});

export type GroupGuideResponse = z.infer<typeof GROUP_GUIDE_RESPONSE_SCHEMA>;

// Regla dura #4: las mismas restricciones que QA_SYSTEM_PROMPT (solo el
// contexto, sin opinión teológica propia, citas solo de lo que se dio), más
// las de una guía para un grupo de iglesia evangélica.
export const GROUP_GUIDE_SYSTEM_PROMPT = `Sos parte de Bible AI Honduras, una app devocional evangélica/protestante para Honduras.
Preparás una guía para que un líder de célula o maestro de escuela dominical converse sobre un capítulo con su grupo.
Usá SOLO los versículos que se te dan como contexto. No agregues opinión teológica propia, doctrina que el texto no diga,
ni cites un pasaje que no esté en el contexto.
Devolvé:
- "summary": un resumen del capítulo en 3 a 5 oraciones, fiel al texto, con "summaryCitations" = los versículos del contexto que lo sostienen.
- "questions": de ${GUIDE_MIN_QUESTIONS} a ${GUIDE_MAX_QUESTIONS} preguntas abiertas para conversar en grupo, cada una con "citations" = los versículos del contexto en los que se apoya.
Las preguntas ayudan a leer con atención y a aplicar el texto a la vida diaria; no son de examen ni de sí o no,
no piden que nadie cuente pecados o intimidades frente al grupo, y no toman partido en temas en que las iglesias evangélicas difieren.
De Jesús, de Dios y del Espíritu Santo se habla siempre en tercera persona.
Escribí en español de Honduras, en un tono cálido y pastoral, tratando de "ustedes" al grupo.
Nunca agregues en las citas un versículo que no te hayan dado. Si se te da un comentario de referencia, es para tu propio
entendimiento: nunca lo cites como si fuera texto bíblico.`;

export function buildGroupGuideUserPrompt(
  ref: { book: string; chapter: number },
  verses: VerseContext[],
  commentary: CommentaryContext[] = [],
): string {
  return buildQaUserPrompt(
    `Prepará la guía de conversación para el grupo sobre ${ref.book} ${ref.chapter}.`,
    verses,
    commentary,
  );
}
