import { describe, expect, it } from "vitest";

import {
  addDaysTo,
  daysBetween,
  isDue,
  MEMORIZE_MAX_LEVEL,
  MEMORIZE_STEPS_DAYS,
  nextReviewLabel,
  scheduleAfterReview,
  scheduleNew,
} from "./memorizeSchedule";

describe("repaso espaciado de Memorizar (#158)", () => {
  it("los escalones son hoy, 3, 7 y 21 días", () => {
    expect(MEMORIZE_STEPS_DAYS).toEqual([0, 3, 7, 21]);
    expect(MEMORIZE_MAX_LEVEL).toBe(3);
  });

  it("un versículo agregado no toca hoy y sí aparece en el repaso del día siguiente", () => {
    const state = scheduleNew("2026-10-02");
    expect(state).toEqual({ level: 0, nextReview: "2026-10-03" });
    expect(isDue(state, "2026-10-02")).toBe(false);
    expect(isDue(state, "2026-10-03")).toBe(true);
  });

  it("acertar lo espacia más: 3 → 7 → 21 días", () => {
    const first = scheduleAfterReview({ level: 0 }, true, "2026-10-03");
    expect(first).toEqual({ level: 1, nextReview: "2026-10-06" });
    const second = scheduleAfterReview(first, true, "2026-10-06");
    expect(second).toEqual({ level: 2, nextReview: "2026-10-13" });
    const third = scheduleAfterReview(second, true, "2026-10-13");
    expect(third).toEqual({ level: 3, nextReview: "2026-11-03" });
  });

  it("arriba de todo se queda en 21 días", () => {
    expect(scheduleAfterReview({ level: 3 }, true, "2026-11-03")).toEqual({ level: 3, nextReview: "2026-11-24" });
  });

  it("fallar lo vuelve a hoy y al primer escalón, desde cualquier nivel", () => {
    for (const level of [0, 1, 2, 3]) {
      const state = scheduleAfterReview({ level }, false, "2026-10-13");
      expect(state).toEqual({ level: 0, nextReview: "2026-10-13" });
      expect(isDue(state, "2026-10-13")).toBe(true);
    }
  });

  it("después de fallar, acertar el mismo día lo manda a 3 días", () => {
    const failed = scheduleAfterReview({ level: 2 }, false, "2026-10-13");
    expect(scheduleAfterReview(failed, true, "2026-10-13")).toEqual({ level: 1, nextReview: "2026-10-16" });
  });

  it("un nivel fuera de rango o roto no rompe el calendario", () => {
    expect(scheduleAfterReview({ level: 99 }, true, "2026-10-01").level).toBe(3);
    expect(scheduleAfterReview({ level: -4 }, true, "2026-10-01").level).toBe(1);
    expect(scheduleAfterReview({ level: Number.NaN }, true, "2026-10-01").level).toBe(1);
  });

  it("si no abrió la app ese día, el versículo sigue tocando después", () => {
    expect(isDue({ nextReview: "2026-10-03" }, "2026-10-10")).toBe(true);
  });

  it("cruza meses y años", () => {
    expect(addDaysTo("2026-12-25", 21)).toBe("2027-01-15");
    expect(addDaysTo("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-12-25", "2027-01-15")).toBe(21);
  });

  it("etiqueta del próximo repaso", () => {
    expect(nextReviewLabel("2026-10-01", "2026-10-02")).toBe("Hoy");
    expect(nextReviewLabel("2026-10-02", "2026-10-02")).toBe("Hoy");
    expect(nextReviewLabel("2026-10-03", "2026-10-02")).toBe("Mañana");
    expect(nextReviewLabel("2026-10-23", "2026-10-02")).toBe("En 21 días");
  });

  it("rechaza fechas inválidas", () => {
    expect(() => addDaysTo("2 de octubre", 1)).toThrow();
  });
});
