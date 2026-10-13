import { describe, expect, it } from "vitest";

import { CRISIS_REPLY, detectCrisis } from "./crisis";

describe("detectCrisis", () => {
  it.each([
    "Ya no aguanto, quiero morir",
    "Me quiero matar",
    "Me quiero morir",
    "Estoy pensando en quitarme la vida",
    "Tengo pensamientos suicidas desde hace días",
    "No quiero seguir aquí",
    "A veces creo que estaría mejor muerta",
    "Me estoy haciendo daño otra vez",
    "QUIERO SUICIDARME",
  ])("detecta riesgo en primera persona: %s", (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each([
    "¿Qué dice la Biblia sobre el suicidio?",
    "¿Por qué Elías pidió morirse bajo el enebro?",
    "Quiero morir a mí mismo y vivir para Cristo",
    "Me corto el pelo mañana",
    "Tengo miedo por mi familia",
  ])("no interrumpe una pregunta o un sentir común: %s", (text) => {
    expect(detectCrisis(text)).toBe(false);
  });

  it("revisa todos los textos que recibe", () => {
    expect(detectCrisis(undefined, "Soledad", "no vale la pena vivir")).toBe(true);
  });

  it("deriva al 911 de Honduras", () => {
    expect(CRISIS_REPLY).toContain("911");
  });
});
