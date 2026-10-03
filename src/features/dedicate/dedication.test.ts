import { describe, expect, it } from "vitest";

import { tokens } from "../../theme/tokens";
import { dedicationBlockHeight, verseAreaHeight, verseStoryLayout } from "../home/verseStoryLayout";
import {
  buildDedicationShareText,
  cleanDedicationMessage,
  cleanDedicationTo,
  DEDICATION_MESSAGE_MAX,
  DEDICATION_TO_MAX,
  dedicationBlock,
  dedicationTemplates,
  defaultTemplateId,
  fittingFormats,
} from "./dedication";

const image = tokens.storyImage;
// Ester 8:9, de los versículos más largos de RV1909 (~500 caracteres).
const LONG_VERSE =
  "Entonces fueron llamados los escribanos del rey en el mes tercero, que es Siván, á veintitrés del mismo; y escribióse conforme á todo lo que mandó Mardochêo, á los Judíos, y á los sátrapas, capitanes, y príncipes de las provincias que había desde la India hasta la Etiopía, ciento veintisiete provincias; á cada provincia según su escribir, y á cada pueblo conforme á su lengua, á los Judíos también conforme á su escritura y lengua.";

describe("plantillas (#202)", () => {
  it("sin temporada: Clásica, Noche y Cumpleaños, y arranca en Clásica", () => {
    const templates = dedicationTemplates(null);
    expect(templates.map((t) => t.id)).toEqual(["clasica", "noche", "cumpleanos"]);
    expect(defaultTemplateId(templates)).toBe("clasica");
  });

  it("con temporada activa suma la suya (nombre y acento) y arranca en ella", () => {
    const templates = dedicationTemplates({ name: "Adviento", paletteKey: "adviento" });
    const season = templates.find((t) => t.id === "temporada");
    expect(season).toMatchObject({ label: "Adviento", overline: "Adviento" });
    expect(season?.palette.accent).toBe(tokens.season.adviento.day.accent);
    expect(defaultTemplateId(templates)).toBe("temporada");
    // Cumpleaños siempre está.
    expect(templates.at(-1)?.id).toBe("cumpleanos");
  });

  it("una paleta de temporada desconocida no inventa colores", () => {
    expect(dedicationTemplates({ name: "Rara", paletteKey: "neon" }).map((t) => t.id)).not.toContain("temporada");
  });

  it("todos los colores salen de la paleta de tokens", () => {
    const palette = new Set<string>([
      ...Object.values(tokens.color),
      ...Object.values(tokens.night.color),
      ...Object.values(tokens.season).flatMap((s) => Object.values(s.day)),
    ]);
    for (const template of dedicationTemplates({ name: "Reforma", paletteKey: "reforma" })) {
      for (const value of Object.values(template.palette)) expect(palette.has(value)).toBe(true);
    }
  });
});

describe("campos", () => {
  it("el nombre es una línea, sin espacios de más y con tope", () => {
    expect(cleanDedicationTo("  mi\n mamá  ")).toBe("mi mamá ");
    expect(cleanDedicationTo("x".repeat(60))).toHaveLength(DEDICATION_TO_MAX);
  });

  it("la dedicatoria va corrida y con tope", () => {
    expect(cleanDedicationMessage("Gracias\n\npor todo")).toBe("Gracias por todo");
    expect(cleanDedicationMessage("y".repeat(200))).toHaveLength(DEDICATION_MESSAGE_MAX);
  });

  it("el texto que acompaña la imagen nombra a quién y la cita", () => {
    expect(buildDedicationShareText({ to: " Mamá ", reference: "Salmos 46:1", version: "RV1909" })).toBe(
      "Un versículo para Mamá · Salmos 46:1 (RV1909)",
    );
  });
});

describe("nombres y dedicatorias largos no rompen la imagen", () => {
  it("un nombre corto va en un renglón al tamaño grande", () => {
    expect(dedicationBlock("Mamá", "")).toEqual({ toSize: image.dedicationTo, toLines: 1, messageLines: 0 });
  });

  it("un nombre al tope se achica y nunca pasa de dos renglones", () => {
    const block = dedicationBlock("M".repeat(DEDICATION_TO_MAX), "");
    expect(block.toSize).toBeLessThan(image.dedicationTo);
    expect(block.toSize).toBeGreaterThanOrEqual(image.dedicationToMin);
    expect(block.toLines).toBeLessThanOrEqual(2);
  });

  it("la dedicatoria al tope ocupa a lo sumo tres renglones", () => {
    expect(dedicationBlock("Mamá", "palabra ".repeat(12).slice(0, DEDICATION_MESSAGE_MAX)).messageLines).toBeLessThanOrEqual(3);
  });

  it("el versículo más largo entra entero en 9:16 aun con el peor bloque", () => {
    const worst = dedicationBlock("M".repeat(DEDICATION_TO_MAX), "w".repeat(DEDICATION_MESSAGE_MAX));
    const layout = verseStoryLayout(`“${LONG_VERSE}”`, image, { withSeason: true, format: "story", dedication: worst });
    expect(layout.truncated).toBe(false);
    expect(layout.fontSize).toBeGreaterThanOrEqual(image.dedicationVerseMin);
    expect(fittingFormats(LONG_VERSE, worst)).toContain("story");
  });

  it("si no entra en cuadrada, no se ofrece cuadrada (nunca se corta el versículo)", () => {
    const worst = dedicationBlock("M".repeat(DEDICATION_TO_MAX), "w".repeat(DEDICATION_MESSAGE_MAX));
    expect(fittingFormats(LONG_VERSE, worst)).toEqual(["story"]);
    expect(fittingFormats("Dios es nuestro amparo y fortaleza, Nuestro pronto auxilio en las tribulaciones.", worst)).toEqual([
      "story",
      "square",
    ]);
  });

  it("el bloque resta su alto al espacio del versículo", () => {
    const block = dedicationBlock("Mamá", "Gracias por enseñarme a orar.");
    expect(verseAreaHeight(image, { format: "square" }) - verseAreaHeight(image, { format: "square", dedication: block })).toBeCloseTo(
      dedicationBlockHeight(block, image),
    );
  });
});
