import { describe, expect, it } from "vitest";

import { QUOTA_LIMITS } from "../../convex/quotas";
import { limitBodyFor } from "./limitCopy";

describe("limitBodyFor", () => {
  it("usa el cupo real de cada módulo, no los 3 del prototipo", () => {
    expect(limitBodyFor("qa")).toContain(`${QUOTA_LIMITS.qa} preguntas`);
    expect(limitBodyFor("voices")).toContain(`${QUOTA_LIMITS.voices} mensajes`);
    expect(limitBodyFor("feelings")).toContain(`${QUOTA_LIMITS.feelings} devocionales`);
    expect(limitBodyFor("verseImage")).toContain(`${QUOTA_LIMITS.verseImage} fondos con IA`);
  });

  it("los cupos diarios coinciden con el cambio de fecha del servidor", () => {
    expect(limitBodyFor("qa")).toContain("medianoche de Honduras");
    expect(limitBodyFor("voices")).not.toContain("6:00");
  });

  it("historias vuelve cada día y deja abiertas las que ya hizo", () => {
    expect(limitBodyFor("stories")).toContain("de hoy");
    expect(limitBodyFor("stories")).toContain("Mañana");
    expect(limitBodyFor("stories")).not.toContain("muestra");
  });
});
