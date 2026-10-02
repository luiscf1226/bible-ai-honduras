import { describe, expect, it } from "vitest";

import {
  APPLY_TODAY,
  EXPLAIN_SIMPLER,
  FREE_QUESTION_GROUPS,
  WHO_WROTE_IT,
  composerSuggestions,
  emptyStateGroups,
  passageChipLabel,
  samePassage,
} from "./suggestions";

describe("emptyStateGroups", () => {
  it("sin pasaje: tres grupos con dos preguntas cada uno", () => {
    const groups = emptyStateGroups(null);
    expect(groups.map((group) => group.label)).toEqual(["Para entender", "Para mi vida", "Sobre personajes"]);
    for (const group of groups) expect(group.questions).toHaveLength(2);
  });

  it("las preguntas libres no dependen de un pasaje", () => {
    const all = FREE_QUESTION_GROUPS.flatMap((group) => group.questions);
    expect(all).not.toContain(WHO_WROTE_IT);
    expect(all.some((question) => /versículo \d/.test(question))).toBe(false);
  });

  it("con versículo: un solo grupo sobre ese pasaje que pregunta por el versículo", () => {
    const groups = emptyStateGroups({ book: "Juan", chapter: 3, verse: 16 });
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Sobre Juan 3:16");
    expect(groups[0].questions).toEqual(["¿Qué quiere decir el versículo 16?", APPLY_TODAY, WHO_WROTE_IT]);
  });

  it("con capítulo sin versículo: pregunta por la idea del capítulo", () => {
    const [group] = emptyStateGroups({ book: "Romanos", chapter: 8 });
    expect(group.label).toBe("Sobre Romanos 8");
    expect(group.questions[0]).toBe("¿Cuál es la idea central de Romanos 8?");
  });
});

describe("composerSuggestions", () => {
  it("antes de la primera respuesta no hay chips (los ejemplos ya están arriba)", () => {
    expect(composerSuggestions({ passage: null, hasAnswer: false })).toEqual([]);
    expect(composerSuggestions({ passage: { book: "Juan", chapter: 3 }, hasAnswer: false })).toEqual([]);
  });

  it("“Explícalo más simple” solo aparece después de una respuesta", () => {
    expect(composerSuggestions({ passage: null, hasAnswer: true })[0]).toBe(EXPLAIN_SIMPLER);
    expect(composerSuggestions({ passage: { book: "Juan", chapter: 3 }, hasAnswer: true })[0]).toBe(EXPLAIN_SIMPLER);
  });

  it("“¿Quién lo escribió…?” solo con pasaje", () => {
    expect(composerSuggestions({ passage: null, hasAnswer: true })).not.toContain(WHO_WROTE_IT);
    expect(composerSuggestions({ passage: { book: "Juan", chapter: 3 }, hasAnswer: true })).toContain(WHO_WROTE_IT);
  });
});

describe("passageChipLabel", () => {
  it("invita a elegir cuando no hay pasaje", () => {
    expect(passageChipLabel(null)).toBe("Elegir pasaje (opcional)");
  });

  it("muestra el pasaje elegido", () => {
    expect(passageChipLabel({ book: "Juan", chapter: 3 })).toBe("Juan 3");
    expect(passageChipLabel({ book: "Salmos", chapter: 46, verse: 1 })).toBe("Salmos 46:1");
  });
});

describe("samePassage", () => {
  it("compara libro, capítulo y versículo", () => {
    expect(samePassage({ book: "Juan", chapter: 3 }, { book: "Juan", chapter: 3 })).toBe(true);
    expect(samePassage({ book: "Juan", chapter: 3 }, { book: "Juan", chapter: 3, verse: 16 })).toBe(false);
    expect(samePassage({ book: "Génesis", chapter: 1 }, { book: "Romanos", chapter: 8 })).toBe(false);
    expect(samePassage(null, null)).toBe(true);
    expect(samePassage(null, { book: "Juan", chapter: 3 })).toBe(false);
  });
});
