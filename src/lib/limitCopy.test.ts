import { describe, expect, it } from "vitest";

import { QUOTA_LIMITS } from "../../convex/quotas";
import { limitBodyFor, limitTitleFor } from "./limitCopy";

describe("limitBodyFor", () => {
  it("usa el cupo real de cada módulo, no los 3 del prototipo", () => {
    expect(limitBodyFor("qa")).toContain(`${QUOTA_LIMITS.qa} preguntas`);
    expect(limitBodyFor("voices")).toContain(`${QUOTA_LIMITS.voices} conversaciones`);
    expect(limitBodyFor("feelings")).toContain(`${QUOTA_LIMITS.feelings} devocionales`);
  });

  it("los cupos diarios coinciden con el cambio de fecha del servidor", () => {
    expect(limitBodyFor("qa")).toContain("medianoche de Honduras");
    expect(limitBodyFor("voices")).not.toContain("6:00");
  });

  it("historias habla de la muestra de por vida", () => {
    expect(limitBodyFor("stories")).toContain("historia de muestra");
    expect(limitBodyFor("stories")).not.toMatch(/Pro|mañana|medianoche/);
    expect(limitTitleFor("stories")).not.toContain("hoy");
  });
});
