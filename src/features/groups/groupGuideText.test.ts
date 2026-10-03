import { describe, expect, it } from "vitest";

import { buildGuideShareText, citationsLabel, truncatedNotice, type GuideCitation } from "./groupGuideText";

const c = (verse: number): GuideCitation => ({ book: "Rut", chapter: 1, verse, version: "RV1909", text: `v${verse}` });

describe("citationsLabel", () => {
  it("un versículo, un rango seguido o una lista", () => {
    expect(citationsLabel([c(16)])).toBe("Rut 1:16");
    expect(citationsLabel([c(17), c(16)])).toBe("Rut 1:16-17");
    expect(citationsLabel([c(1), c(16)])).toBe("Rut 1:1, 16");
    expect(citationsLabel([])).toBe("");
  });
});

describe("buildGuideShareText", () => {
  it("lleva el resumen y las preguntas numeradas, cada una con su cita", () => {
    const text = buildGuideShareText({
      book: "Rut",
      chapter: 1,
      version: "RV1909",
      summary: { text: "Noemí vuelve a Belén.", citations: [c(1)] },
      questions: [
        { text: "¿Qué decide Rut?", citations: [c(16), c(17)] },
        { text: "¿Cómo llega Noemí?", citations: [c(19)] },
      ],
      truncatedAtVerse: null,
    });
    expect(text).toBe(
      [
        "Para conversar en el grupo · Rut 1 (RV1909)",
        "",
        "Noemí vuelve a Belén. (Rut 1:1)",
        "",
        "1. ¿Qué decide Rut? (Rut 1:16-17)",
        "2. ¿Cómo llega Noemí? (Rut 1:19)",
      ].join("\n"),
    );
  });
});

describe("truncatedNotice", () => {
  it("solo avisa cuando el capítulo se recortó", () => {
    expect(truncatedNotice({ truncatedAtVerse: null })).toBeNull();
    expect(truncatedNotice({ truncatedAtVerse: 60 })).toContain("hasta el versículo 60");
  });
});
