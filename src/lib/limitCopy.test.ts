import { describe, expect, it } from "vitest";

import { QUOTA_LIMITS } from "../../convex/quotas";
import { limitBodyFor } from "./limitCopy";

describe("limitBodyFor", () => {
  it("usa el cupo real de cada módulo, no los 3 del prototipo", () => {
    expect(limitBodyFor("qa")).toContain(`${QUOTA_LIMITS.qa} preguntas`);
    expect(limitBodyFor("voices")).toContain(`${QUOTA_LIMITS.voices} conversaciones`);
    expect(limitBodyFor("feelings")).toContain(`${QUOTA_LIMITS.feelings} devocionales`);
  });

  it("historias habla de la muestra de por vida", () => {
    expect(limitBodyFor("stories")).toContain("historia de muestra");
  });
});
