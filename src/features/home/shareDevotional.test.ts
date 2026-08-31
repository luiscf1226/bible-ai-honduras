import { describe, expect, it } from "vitest";

import { buildDevotionalShareText } from "./shareDevotional";

describe("buildDevotionalShareText", () => {
  it("incluye la referencia y reflexión editorial del devocional", () => {
    const message = buildDevotionalShareText({
      reflection: "Dios puede sostenerte mientras caminás paso a paso.",
      verseRef: "Isaías 41:10",
      version: "RV1909"
    });

    expect(message).toContain("Isaías 41:10");
    // La versión sale del contenido citado, no de una constante en el texto:
    // el corpus de la beta es RV1909 y decir "RVR1960" sería citar mal (#93).
    expect(message).toContain("RV1909");
    expect(message).toContain("Dios puede sostenerte mientras caminás paso a paso.");
  });
});
