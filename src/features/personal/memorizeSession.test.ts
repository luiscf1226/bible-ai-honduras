import { describe, expect, it } from "vitest";

import { nextPending, reviewFeedback, sessionProgress, sessionSummary, startSession, summaryCopy } from "./memorizeSession";

describe("repaso del día de Memorizar (#158)", () => {
  const items = [
    { id: "a", due: true, text: "Jehová es mi pastor" },
    { id: "b", due: false, text: "Todo lo puedo" },
    { id: "c", due: true, text: null },
    { id: "d", due: true, text: "Porque de tal manera" },
  ];

  it("entran los que tocan hoy y tienen texto del corpus", () => {
    expect(startSession(items)).toEqual(["a", "d"]);
  });

  it("avanza en orden y no repite uno fallado en la misma vuelta", () => {
    const session = ["a", "d"];
    expect(nextPending(session, {})).toBe("a");
    expect(sessionProgress(session, "a")).toBe("1 de 2");
    expect(nextPending(session, { a: false })).toBe("d");
    expect(nextPending(session, { a: false, d: true })).toBeNull();
    expect(sessionSummary(session, { a: false, d: true })).toEqual({ total: 2, correct: 1, failedIds: ["a"] });
  });

  it("dice cuándo vuelve, o que queda para hoy", () => {
    expect(reviewFeedback(true, "2026-10-05", "2026-10-02")).toBe("¡Bien! Vuelve a tu repaso en 3 días.");
    expect(reviewFeedback(true, "2026-10-03", "2026-10-02")).toBe("¡Bien! Vuelve a tu repaso mañana.");
    expect(reviewFeedback(false, "2026-10-02", "2026-10-02")).toContain("hoy otra vez");
  });

  it("resumen del final", () => {
    expect(summaryCopy({ total: 0, correct: 0 })).toBe("Nada para repasar hoy.");
    expect(summaryCopy({ total: 1, correct: 1 })).toBe("Acertaste el versículo de hoy.");
    expect(summaryCopy({ total: 3, correct: 3 })).toBe("Acertaste los 3 versículos de hoy.");
    expect(summaryCopy({ total: 3, correct: 1 })).toBe("Acertaste 1 de 3. Los que fallaste quedan para hoy.");
  });
});
