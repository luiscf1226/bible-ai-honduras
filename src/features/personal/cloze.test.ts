import { describe, expect, it } from "vitest";

import {
  blanksFor,
  buildCloze,
  CLOZE_MAX_BLANKS,
  clearBlank,
  emptyFill,
  gradeCloze,
  isComplete,
  placeWord,
  tokenize,
  type Cloze,
} from "./cloze";

const SALMO = "Jehová es mi pastor; nada me faltará.";
const JUAN =
  "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.";

/** Reconstruye el versículo con las respuestas en su lugar. */
function rebuild(cloze: Cloze): string {
  return cloze.parts.map((part) => (part.kind === "text" ? part.text : cloze.answers[part.blank])).join("");
}

describe("ejercicio de completar palabras (#158)", () => {
  it("tokeniza palabras con tildes y deja la puntuación aparte", () => {
    expect(tokenize("Jehová es mi pastor;")).toEqual([
      { word: true, text: "Jehová" },
      { word: false, text: " " },
      { word: true, text: "es" },
      { word: false, text: " " },
      { word: true, text: "mi" },
      { word: false, text: " " },
      { word: true, text: "pastor" },
      { word: false, text: ";" },
    ]);
  });

  it("esconde más palabras a medida que sube el nivel, con mínimo uno y un tope", () => {
    expect(blanksFor(0, 20)).toBe(5);
    expect(blanksFor(1, 20)).toBe(8);
    expect(blanksFor(2, 20)).toBe(CLOZE_MAX_BLANKS);
    expect(blanksFor(0, 2)).toBe(1);
    expect(blanksFor(3, 4)).toBe(3);
    expect(blanksFor(0, 0)).toBe(0);
    expect(blanksFor(Number.NaN, 4)).toBe(1);
  });

  it("solo esconde palabras de 3 letras o más y el texto se puede reconstruir", () => {
    for (const level of [0, 1, 2, 3]) {
      const cloze = buildCloze(JUAN, level, `Juan 3:16|2026-10-02|${level}`);
      expect(rebuild(cloze)).toBe(JUAN);
      expect(cloze.answers.length).toBeGreaterThan(0);
      for (const answer of cloze.answers) {
        expect(answer.length).toBeGreaterThanOrEqual(3);
      }
      expect([...cloze.bank].sort()).toEqual([...cloze.answers].sort());
    }
    // "es", "mi", "me" nunca son hueco.
    const salmo = buildCloze(SALMO, 3, "Salmos 23:1");
    expect(salmo.answers.every((answer) => !["es", "mi", "me"].includes(answer))).toBe(true);
  });

  it("es determinístico por semilla y cambia con otra semilla", () => {
    const a = buildCloze(JUAN, 1, "Juan 3:16|2026-10-02");
    expect(buildCloze(JUAN, 1, "Juan 3:16|2026-10-02")).toEqual(a);
    const others = ["2026-10-03", "2026-10-04", "2026-10-05"].map((day) => buildCloze(JUAN, 1, `Juan 3:16|${day}`).answers.join());
    expect(others.some((answers) => answers !== a.answers.join())).toBe(true);
  });

  it("un versículo sin palabras largas no tiene huecos", () => {
    expect(buildCloze("y á mí", 3, "x").answers).toEqual([]);
  });

  it("tocar palabras llena los huecos en orden; tocar un hueco la devuelve al banco", () => {
    const cloze = buildCloze(SALMO, 3, "Salmos 23:1|2026-10-02");
    let filled = emptyFill(cloze);
    expect(filled.length).toBe(cloze.answers.length);
    filled = placeWord(filled, 0);
    expect(filled[0]).toBe(0);
    // Una palabra ya usada no se pone dos veces.
    expect(placeWord(filled, 0)).toBe(filled);
    filled = clearBlank(filled, 0);
    expect(filled[0]).toBeNull();
    expect(clearBlank(filled, 0)).toBe(filled);
  });

  it("corrige: todo en su lugar acierta, un cambio falla, sin mirar mayúsculas ni tildes", () => {
    const cloze = buildCloze(JUAN, 2, "Juan 3:16|2026-10-02");
    // Lo correcto: para cada hueco, el índice del banco con esa palabra.
    let right = emptyFill(cloze);
    const used = new Set<number>();
    cloze.answers.forEach((answer, blank) => {
      const index = cloze.bank.findIndex((word, i) => word === answer && !used.has(i));
      used.add(index);
      right = [...right];
      right[blank] = index;
    });
    expect(isComplete(right)).toBe(true);
    expect(gradeCloze(cloze, right)).toBe(true);

    const swapped = [...right];
    const first = cloze.answers.findIndex((answer) => answer !== cloze.answers[1]);
    if (first !== 1 && cloze.answers.length > 1) {
      [swapped[first], swapped[1]] = [swapped[1], swapped[first]];
      expect(gradeCloze(cloze, swapped)).toBe(false);
    }

    expect(gradeCloze(cloze, emptyFill(cloze))).toBe(false);
    const accents: Cloze = { parts: [{ kind: "blank", blank: 0 }], answers: ["Jehová"], bank: ["jehova"] };
    expect(gradeCloze(accents, [0])).toBe(true);
  });
});
