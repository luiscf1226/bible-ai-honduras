import { describe, expect, it } from "vitest";

import { voiceCharacters } from "./voicesCatalog";
import { buildVoicesSystemPrompt } from "./voicesPrompt";

describe("buildVoicesSystemPrompt", () => {
  it("pide 1ra persona del personaje y 3ra persona para Dios/Jesús/Espíritu Santo", () => {
    const moises = voiceCharacters.find((character) => character.slug === "moises");
    if (!moises) {
      throw new Error("falta Moisés en el catálogo");
    }
    const prompt = buildVoicesSystemPrompt(moises);
    expect(prompt).toContain("Moisés");
    expect(prompt).toContain("primera persona");
    expect(prompt).toContain("tercera persona");
    expect(prompt).toContain("Jesús");
    expect(prompt).toContain("Espíritu Santo");
  });
});
