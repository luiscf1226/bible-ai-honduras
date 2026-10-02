import { describe, expect, it } from "vitest";

import { tokens } from "../../theme/tokens";
import { estimateLines, storyCaptureSize, storyChrome, verseAreaHeight, verseStoryLayout } from "./verseStoryLayout";

const image = tokens.storyImage;
const SALMO_46_1 = "Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.";
const JUAN_3_16 =
  "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.";
const LONG = Array.from({ length: 3 }, () => JUAN_3_16).join(" ");
const VERY_LONG = Array.from({ length: 20 }, () => JUAN_3_16).join(" ");

describe("estimateLines", () => {
  it("cuenta 0 renglones para texto vacío", () => {
    expect(estimateLines("   ", 20)).toBe(0);
  });

  it("parte por palabras, no por caracteres", () => {
    expect(estimateLines("uno dos tres", 7)).toBe(2); // "uno dos" | "tres"
    expect(estimateLines("uno dos tres", 100)).toBe(1);
  });

  it("una palabra más larga que el renglón ocupa varios renglones", () => {
    expect(estimateLines("abcdefghij", 4)).toBe(3);
  });
});

describe("verseStoryLayout (#161)", () => {
  it("un versículo corto va en el tamaño máximo", () => {
    const layout = verseStoryLayout(SALMO_46_1);
    expect(layout.fontSize).toBe(image.verseMax);
    expect(layout.truncated).toBe(false);
  });

  it("el tamaño siempre queda entre verseMin y verseMax", () => {
    for (const text of ["Jesús lloró.", SALMO_46_1, JUAN_3_16, LONG, VERY_LONG]) {
      const { fontSize } = verseStoryLayout(text);
      expect(fontSize).toBeGreaterThanOrEqual(image.verseMin);
      expect(fontSize).toBeLessThanOrEqual(image.verseMax);
    }
  });

  it("a más largo el versículo, la letra nunca crece", () => {
    const sizes = [SALMO_46_1, JUAN_3_16, LONG, VERY_LONG].map((text) => verseStoryLayout(text).fontSize);
    for (let index = 1; index < sizes.length; index += 1) {
      expect(sizes[index]).toBeLessThanOrEqual(sizes[index - 1]);
    }
    expect(sizes[2]).toBeLessThan(image.verseMax);
  });

  it("lo que entra sin cortar cabe en el alto disponible", () => {
    for (const text of [SALMO_46_1, JUAN_3_16, LONG]) {
      const layout = verseStoryLayout(text);
      expect(layout.truncated).toBe(false);
      expect(layout.lines * layout.lineHeight).toBeLessThanOrEqual(verseAreaHeight());
    }
  });

  it("un texto que no entra ni en verseMin se corta con maxLines", () => {
    const layout = verseStoryLayout(VERY_LONG);
    expect(layout.fontSize).toBe(image.verseMin);
    expect(layout.truncated).toBe(true);
    expect(layout.maxLines * layout.lineHeight).toBeLessThanOrEqual(verseAreaHeight());
  });

  it("el interlineado sale del token, no de un número suelto", () => {
    const layout = verseStoryLayout(SALMO_46_1);
    expect(layout.lineHeight).toBe(Math.round(layout.fontSize * image.verseLineHeight));
  });
});

describe("verseStoryLayout con temporada (#199)", () => {
  it("el nombre de la temporada le quita alto al versículo, nunca se lo suma", () => {
    expect(verseAreaHeight(image, { withSeason: true })).toBeLessThan(verseAreaHeight());
    expect(verseAreaHeight(image, { withSeason: false })).toBe(verseAreaHeight());
  });

  it("sin temporada la imagen queda igual que antes", () => {
    for (const text of [SALMO_46_1, JUAN_3_16, LONG, VERY_LONG]) {
      expect(verseStoryLayout(text, image, {})).toEqual(verseStoryLayout(text));
    }
  });

  it("con temporada, lo que entra sin cortar cabe en el alto que queda", () => {
    for (const text of [SALMO_46_1, JUAN_3_16, LONG, VERY_LONG]) {
      const layout = verseStoryLayout(text, image, { withSeason: true });
      const shown = layout.truncated ? layout.maxLines : layout.lines;
      expect(shown * layout.lineHeight).toBeLessThanOrEqual(verseAreaHeight(image, { withSeason: true }));
    }
  });

  it("el renglón del nombre cabe en la franja que se le reserva", () => {
    expect(storyChrome().seasonLineHeight).toBeLessThanOrEqual(image.season * 2);
  });
});

describe("storyCaptureSize (PNG de 1080×1920)", () => {
  it("iOS pide puntos: 1080×1920 dividido por la densidad", () => {
    expect(storyCaptureSize("ios", 3)).toEqual({ width: 360, height: 640 });
    expect(storyCaptureSize("ios", 2)).toEqual({ width: 540, height: 960 });
  });

  it("Android y web piden píxeles", () => {
    expect(storyCaptureSize("android", 2.75)).toEqual({ width: image.width, height: image.height });
    expect(storyCaptureSize("web", 2)).toEqual({ width: image.width, height: image.height });
  });

  it("siempre 9:16", () => {
    const { width, height } = storyCaptureSize("ios", 3);
    expect(width / height).toBeCloseTo(9 / 16);
  });
});

describe("storyChrome", () => {
  it("la marca entra en el espacio que verseAreaHeight le reserva", () => {
    const chrome = storyChrome();
    expect(chrome.logoSize).toBeLessThanOrEqual(image.brand * 4);
    expect(chrome.referenceGap).toBe(image.reference);
  });
});
