import { describe, expect, it } from "vitest";

import { fallbackFeedPhoto, type FeedPassage } from "./verseFeedCore";
import { clampEndVerse, feedRefsCovering, photosFor, topicsFor, VERSE_IMAGE_MAX_VERSES, verseImageRef } from "./verseImageCore";

const passage = (ref: string, book: string, chapter: number, verse: number, endVerse: number | null): FeedPassage => ({
  ref,
  book,
  chapter,
  verse,
  endVerse,
  topics: ["paz"],
  imageUrl: "",
  imageAlt: "",
});

describe("cita del pasaje", () => {
  it("arma la misma llave que el catálogo del feed", () => {
    expect(verseImageRef({ book: "Juan", chapter: 3, verse: 16, endVerse: null })).toBe("Juan 3:16");
    expect(verseImageRef({ book: "Filipenses", chapter: 4, verse: 6, endVerse: 7 })).toBe("Filipenses 4:6-7");
  });

  it("un rango inválido es un solo versículo y uno largo se acota al tope", () => {
    expect(clampEndVerse(5, undefined)).toBeNull();
    expect(clampEndVerse(5, 5)).toBeNull();
    expect(clampEndVerse(5, 3)).toBeNull();
    expect(clampEndVerse(5, 6.5)).toBeNull();
    expect(clampEndVerse(5, 7)).toBe(7);
    expect(clampEndVerse(1, 40)).toBe(VERSE_IMAGE_MAX_VERSES);
  });
});

describe("feedRefsCovering", () => {
  const pool = [
    passage("Filipenses 4:4-9", "Filipenses", 4, 4, 9),
    passage("Filipenses 4:6-7", "Filipenses", 4, 6, 7),
    passage("Filipenses 4:13", "Filipenses", 4, 13, null),
    passage("Juan 4:6", "Juan", 4, 6, null),
  ];

  it("primero la cita propia y después las del feed que la contienen, de la más justa a la más amplia", () => {
    expect(feedRefsCovering({ book: "Filipenses", chapter: 4, verse: 6, endVerse: null }, pool)).toEqual([
      "Filipenses 4:6",
      "Filipenses 4:6-7",
      "Filipenses 4:4-9",
    ]);
  });

  it("un rango solo usa las citas que lo cubren entero; la propia no se repite", () => {
    expect(feedRefsCovering({ book: "Filipenses", chapter: 4, verse: 6, endVerse: 8 }, pool)).toEqual([
      "Filipenses 4:6-8",
      "Filipenses 4:4-9",
    ]);
    expect(feedRefsCovering({ book: "Filipenses", chapter: 4, verse: 13, endVerse: null }, pool)).toEqual(["Filipenses 4:13"]);
  });

  it("los temas salen del catálogo; fuera del feed no hay", () => {
    expect(topicsFor("Filipenses 4:13", pool)).toEqual(["paz"]);
    expect(topicsFor("Números 6:24", pool)).toEqual([]);
  });
});

describe("photosFor", () => {
  it("empieza por la foto que el feed le asigna a la cita y trae todas, con ids fijos", () => {
    const photos = photosFor("Juan 3:16");
    expect(photos[0].imageUrl).toBe(fallbackFeedPhoto("Juan 3:16").imageUrl);
    expect(new Set(photos.map((photo) => photo.id)).size).toBe(photos.length);
    expect([...photosFor("Salmos 23:1")].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...photos].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});
