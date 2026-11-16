import { describe, expect, it } from "vitest";

import { QUOTA_LIMITS } from "../../../convex/quotas";
import { fittingStoryFormats, verseStoryLayout } from "../home/verseStoryLayout";
import { tokens } from "../../theme/tokens";
import {
  AI_BACKGROUND_ID,
  aiNoticeText,
  buildVerseImageShareText,
  chooseBackground,
  composerBackgrounds,
  DEFAULT_VERSE_IMAGE_STYLE,
  parseSavedStyle,
  readVerseImageParams,
  verseImageReference,
} from "./verseImageLogic";

const PHOTOS = [
  { id: "foto-3", imageUrl: "https://x/3.jpg", imageAlt: "Lago" },
  { id: "foto-1", imageUrl: "https://x/1.jpg", imageAlt: "Monte" },
];

describe("composerBackgrounds", () => {
  it("IA primero (si hay), después las fotos y al final los colores de siempre", () => {
    const items = composerBackgrounds({ aiImageUrl: "https://ai/1.webp", photos: PHOTOS });
    expect(items.map((item) => item.id)).toEqual([AI_BACKGROUND_ID, "foto-3", "foto-1", "clasica", "noche", "arena"]);
    expect(items.map((item) => item.label)).toEqual(["Con IA", "Foto 1", "Foto 2", "Papel", "Noche", "Arena"]);
  });

  it("sin fondo de IA no hay miniatura de IA; con temporada suma su color con su nombre", () => {
    const items = composerBackgrounds({ aiImageUrl: null, photos: PHOTOS, season: { name: "Adviento", paletteKey: "adviento" } });
    expect(items.some((item) => item.id === AI_BACKGROUND_ID)).toBe(false);
    const season = items.find((item) => item.id === "temporada");
    expect(season?.label).toBe("Adviento");
    expect(season?.kind === "color" && season.palette.accent).toBe(tokens.season.adviento.day.accent);
  });
});

describe("chooseBackground", () => {
  const withAi = composerBackgrounds({ aiImageUrl: "https://ai/1.webp", photos: PHOTOS });
  const withoutAi = composerBackgrounds({ aiImageUrl: null, photos: PHOTOS });

  it("respeta lo elegido si existe para esta cita", () => {
    expect(chooseBackground("noche", withAi)?.id).toBe("noche");
    expect(chooseBackground("foto-1", withoutAi)?.id).toBe("foto-1");
  });

  it("si no, el de IA; si tampoco hay, la primera foto", () => {
    expect(chooseBackground(null, withAi)?.id).toBe(AI_BACKGROUND_ID);
    expect(chooseBackground(AI_BACKGROUND_ID, withoutAi)?.id).toBe("foto-3");
    expect(chooseBackground("temporada", withoutAi)?.id).toBe("foto-3");
    expect(chooseBackground(null, [])).toBeNull();
  });
});

describe("parseSavedStyle", () => {
  it("lee lo guardado y descarta campo por campo lo que no reconoce", () => {
    expect(parseSavedStyle(JSON.stringify({ background: "noche", layout: "poster", format: "square" }))).toEqual({
      background: "noche",
      layout: "poster",
      format: "square",
    });
    expect(parseSavedStyle(JSON.stringify({ background: 3, layout: "rara", format: "square" }))).toEqual({
      background: null,
      layout: "classic",
      format: "square",
    });
  });

  it("nada, basura o JSON roto vuelven al estilo de siempre", () => {
    expect(parseSavedStyle(null)).toEqual(DEFAULT_VERSE_IMAGE_STYLE);
    expect(parseSavedStyle("{")).toEqual(DEFAULT_VERSE_IMAGE_STYLE);
    expect(parseSavedStyle("42")).toEqual(DEFAULT_VERSE_IMAGE_STYLE);
  });
});

describe("readVerseImageParams", () => {
  it("lee un versículo y un rango; un final inválido es un solo versículo", () => {
    expect(readVerseImageParams({ book: "Filipenses", chapter: "4", verse: "6", verseEnd: "7" })).toEqual({
      book: "Filipenses",
      chapter: 4,
      verse: 6,
      verseEnd: 7,
    });
    expect(readVerseImageParams({ book: "Juan", chapter: "3", verse: "16", verseEnd: "16" })?.verseEnd).toBeNull();
    expect(readVerseImageParams({ book: "Juan", chapter: "3", verse: "16", verseEnd: "x" })?.verseEnd).toBeNull();
  });

  it("libro, capítulo o versículo inválidos son null", () => {
    expect(readVerseImageParams({ book: "Nada", chapter: "1", verse: "1" })).toBeNull();
    expect(readVerseImageParams({ book: "Juan", chapter: "99", verse: "1" })).toBeNull();
    expect(readVerseImageParams({ book: "Juan", chapter: "3" })).toBeNull();
  });
});

describe("textos", () => {
  it("cita con el final que trajo el corpus y texto corto para compartir", () => {
    expect(verseImageReference({ book: "Filipenses", chapter: 4, verse: 6 }, 7)).toBe("Filipenses 4:6-7");
    expect(verseImageReference({ book: "Juan", chapter: 3, verse: 16 }, null)).toBe("Juan 3:16");
    expect(buildVerseImageShareText({ reference: "Juan 3:16", version: "RV1909" })).toBe("Juan 3:16 (RV1909)");
  });

  it("los avisos del fondo con IA nunca hablan de Pro y el límite usa la cuota del servicio", () => {
    expect(aiNoticeText("limit")).toContain(`${QUOTA_LIMITS.verseImage} fondos con IA`);
    for (const notice of ["limit", "no_credit", "failed", "busy"] as const) expect(aiNoticeText(notice)).not.toMatch(/\bPro\b/);
    expect(aiNoticeText(null)).toBeNull();
  });
});

describe("composiciones", () => {
  const image = tokens.storyImage;
  const SHORT = "“Jehová es mi pastor; nada me faltará.”";

  it("Póster arranca más grande y Minimal más chico que la clásica", () => {
    expect(verseStoryLayout(SHORT, image, { layout: "poster" }).fontSize).toBe(image.posterVerseMax);
    expect(verseStoryLayout(SHORT, image, { layout: "minimal" }).fontSize).toBe(image.minimalVerseMax);
    expect(verseStoryLayout(SHORT, image).fontSize).toBe(image.verseMax);
  });

  it("con fitWhole un pasaje largo entra entero en 9:16; uno enorme no entra en ningún formato", () => {
    const long = "y ".repeat(450).trim();
    expect(verseStoryLayout(long, image, { layout: "poster" }).truncated).toBe(true);
    expect(fittingStoryFormats(long, { layout: "poster", fitWhole: true })).toEqual(["story"]);
    expect(fittingStoryFormats("palabra ".repeat(600), { fitWhole: true })).toEqual([]);
  });
});
