export type VerseContext = {
  book: string;
  chapter: number;
  verse: number;
  version: string;
  text: string;
};

// Regla dura #4 (CLAUDE.md): nada de opinión teológica libre. La respuesta
// se restringe al contexto bíblico recuperado por RAG.
export const QA_SYSTEM_PROMPT = `Sos parte de Bible AI Honduras, una app devocional evangélica/protestante para Honduras.
Respondé preguntas bíblicas SOLO a partir de los versículos que se te dan como contexto.
No agregues opinión teológica propia ni cites un pasaje que no esté en el contexto.
Si el contexto no alcanza para responder con seguridad, decilo con honestidad en vez de inventar.
Respondé en español de Honduras, en un tono cálido y pastoral, en 2 a 4 oraciones.`;

export function formatCitation(verse: VerseContext): string {
  return `${verse.book} ${verse.chapter}:${verse.verse} (${verse.version})`;
}

export function buildQaUserPrompt(question: string, verses: VerseContext[]): string {
  const context = verses.map((verse) => `${formatCitation(verse)} — "${verse.text}"`).join("\n");
  return `Contexto bíblico (usalo como única fuente, no agregues otros pasajes):\n${context}\n\nPregunta: ${question}`;
}

export const NO_RELEVANT_CONTENT_ANSWER =
  "No encontré un versículo que responda bien a esto todavía. Probá reformular la pregunta o elegí un pasaje directamente.";
