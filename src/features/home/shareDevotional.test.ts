import { describe, expect, it } from "vitest";

import { buildDevotionalShareText, buildVerseImageShareText } from "./shareDevotional";

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

  it("suma la oración final cuando el devocional la trae", () => {
    const message = buildDevotionalShareText({
      closingPrayer: "Señor, guiame hoy. Amén.",
      reflection: "Dios puede sostenerte mientras caminás paso a paso.",
      verseRef: "Isaías 41:10",
      version: "RV1909"
    });

    expect(message).toContain("Dios puede sostenerte mientras caminás paso a paso.\n\nSeñor, guiame hoy. Amén.");
    expect(message.endsWith("Que esta Palabra te acompañe hoy.")).toBe(true);
  });
});

describe("buildVerseImageShareText (#161)", () => {
  it("nombra el versículo y la versión citada, sin la reflexión", () => {
    const message = buildVerseImageShareText({ verseRef: "Salmos 46:1", version: "RV1909" });
    expect(message).toBe("Versículo de hoy · Salmos 46:1 (RV1909)");
  });
});
