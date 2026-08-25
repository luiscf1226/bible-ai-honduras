import { describe, expect, it } from "vitest";

import { buildQaUserPrompt, formatCitation, NO_RELEVANT_CONTENT_ANSWER, QA_RESPONSE_SCHEMA, QA_SYSTEM_PROMPT } from "./qa";

const VERSE = { book: "Salmos", chapter: 23, verse: 1, version: "RVR1960", text: "Jehová es mi pastor; nada me faltará." };

describe("formatCitation", () => {
  it("arma la referencia legible", () => {
    expect(formatCitation(VERSE)).toBe("Salmos 23:1 (RVR1960)");
  });
});

describe("buildQaUserPrompt", () => {
  it("incluye la pregunta y el texto del versículo citado", () => {
    const prompt = buildQaUserPrompt("¿Quién es mi pastor?", [VERSE]);
    expect(prompt).toContain("¿Quién es mi pastor?");
    expect(prompt).toContain(VERSE.text);
    expect(prompt).toContain(formatCitation(VERSE));
  });

  it("incluye todos los versículos cuando hay más de uno", () => {
    const second = { ...VERSE, verse: 2, text: "En lugares de delicados pastos me hará descansar." };
    const prompt = buildQaUserPrompt("¿Qué más dice?", [VERSE, second]);
    expect(prompt).toContain(VERSE.text);
    expect(prompt).toContain(second.text);
  });

  it("sin comentario, no agrega la sección de comentario", () => {
    const prompt = buildQaUserPrompt("¿Quién es mi pastor?", [VERSE]);
    expect(prompt).not.toContain("Comentario de referencia");
  });

  it("con comentario (#6), lo incluye marcado como contexto, no como texto bíblico", () => {
    const commentary = [
      { source: "Comentario de referencia (muestra)", book: "Salmos", chapter: 23, text: "La imagen del pastor viene de la experiencia diaria de David." },
    ];
    const prompt = buildQaUserPrompt("¿Quién es mi pastor?", [VERSE], commentary);
    expect(prompt).toContain("Comentario de referencia (contexto, no es texto bíblico)");
    expect(prompt).toContain("La imagen del pastor viene de la experiencia diaria de David.");
  });
});

describe("QA_SYSTEM_PROMPT / NO_RELEVANT_CONTENT_ANSWER", () => {
  it("el system prompt prohíbe opinión fuera del contexto (regla dura #4)", () => {
    expect(QA_SYSTEM_PROMPT).toContain("SOLO a partir de los versículos");
  });

  it("el system prompt aclara que el comentario nunca se cita como texto bíblico (#6)", () => {
    expect(QA_SYSTEM_PROMPT).toContain("nunca lo cites como si fuera texto bíblico");
  });

  it("la respuesta de fallback no inventa una cita", () => {
    expect(NO_RELEVANT_CONTENT_ANSWER).not.toMatch(/\d+:\d+/);
  });
});

describe("QA_RESPONSE_SCHEMA", () => {
  it("acepta answer + citations[] bien formadas", () => {
    const result = QA_RESPONSE_SCHEMA.safeParse({
      answer: "Dios cuida de vos.",
      citations: [{ book: "Salmos", chapter: 23, verse: 1, version: "RVR1960" }],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una cita con campos faltantes", () => {
    const result = QA_RESPONSE_SCHEMA.safeParse({
      answer: "Dios cuida de vos.",
      citations: [{ book: "Salmos" }],
    });
    expect(result.success).toBe(false);
  });
});
