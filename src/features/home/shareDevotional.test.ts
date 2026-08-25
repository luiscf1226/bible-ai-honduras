import { describe, expect, it } from "vitest";

import { buildDevotionalShareText } from "./shareDevotional";

describe("buildDevotionalShareText", () => {
  it("incluye la referencia y reflexión editorial del devocional", () => {
    const message = buildDevotionalShareText({
      reflection: "Dios puede sostenerte mientras caminás paso a paso.",
      verseRef: "Isaías 41:10"
    });

    expect(message).toContain("Isaías 41:10");
    expect(message).toContain("RVR1960");
    expect(message).toContain("Dios puede sostenerte mientras caminás paso a paso.");
  });
});
