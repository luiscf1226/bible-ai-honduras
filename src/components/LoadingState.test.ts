import { describe, expect, it } from "vitest";

import {
  FEELING_GEN_STEPS,
  LOADING_STEP_INTERVAL_MS,
  QA_ANSWER_STEPS,
  loadingStepAt,
} from "./loadingSteps";

describe("loadingStepAt", () => {
  it("devuelve el primer paso al inicio", () => {
    expect(loadingStepAt(FEELING_GEN_STEPS, 0)).toBe(FEELING_GEN_STEPS[0]);
  });

  it("avanza al siguiente paso tras el intervalo", () => {
    expect(loadingStepAt(FEELING_GEN_STEPS, LOADING_STEP_INTERVAL_MS)).toBe(FEELING_GEN_STEPS[1]);
  });

  it("cicla de vuelta al primero", () => {
    const elapsed = LOADING_STEP_INTERVAL_MS * FEELING_GEN_STEPS.length;
    expect(loadingStepAt(FEELING_GEN_STEPS, elapsed)).toBe(FEELING_GEN_STEPS[0]);
  });

  it("usa los pasos de Q&A del prototipo como primera línea", () => {
    expect(loadingStepAt(QA_ANSWER_STEPS, 0)).toBe("Buscando en el texto…");
  });

  it("devuelve vacío si no hay pasos", () => {
    expect(loadingStepAt([], 1_000)).toBe("");
  });
});
