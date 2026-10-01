import { describe, expect, it } from "vitest";

import { voiceCharacters } from "../../../convex/voicesCatalog";
import { BIBLE_BOOKS } from "../../lib/bibleBooks";
import { CHAPTER_VOICES, voiceDraftFor, voiceForChapter } from "./chapterVoice";

describe("voiceForChapter", () => {
  it("sugiere al personaje que vivió el capítulo", () => {
    expect(voiceForChapter("Éxodo", 14)).toEqual({ slug: "moises", name: "Moisés", role: "vivio" });
    expect(voiceForChapter("1 Samuel", 17)?.slug).toBe("david");
    expect(voiceForChapter("Rut", 1)?.slug).toBe("rut");
    expect(voiceForChapter("Ester", 4)?.slug).toBe("ester");
    expect(voiceForChapter("1 Reyes", 19)?.slug).toBe("elias");
    expect(voiceForChapter("Hechos", 9)?.slug).toBe("pablo");
  });

  it("en salmos y cartas el personaje es quien lo escribió", () => {
    expect(voiceForChapter("Salmos", 23)).toEqual({ slug: "david", name: "David", role: "escribio" });
    expect(voiceForChapter("Filipenses", 4)).toEqual({ slug: "pablo", name: "Pablo", role: "escribio" });
  });

  it("no fuerza una sugerencia donde no hay personaje", () => {
    expect(voiceForChapter("Génesis", 1)).toBeNull();
    expect(voiceForChapter("Éxodo", 1)).toBeNull(); // antes de que nazca Moisés
    expect(voiceForChapter("Salmos", 90)).toBeNull(); // salmo de Moisés, no de David
    expect(voiceForChapter("Juan", 3)).toBeNull();
    expect(voiceForChapter("Hechos", 2)).toBeNull();
    expect(voiceForChapter("1 Reyes", 10)).toBeNull();
  });

  it("solo usa personajes del catálogo de Voces (regla dura #2: todos humanos)", () => {
    const slugs = new Set(voiceCharacters.map((item) => item.slug));
    for (const slug of Object.keys(CHAPTER_VOICES)) {
      expect(slugs.has(slug)).toBe(true);
    }
    for (const forbidden of ["jesus", "dios", "espiritu-santo"]) {
      expect(Object.keys(CHAPTER_VOICES)).not.toContain(forbidden);
    }
  });

  it("cada rango apunta a un libro y capítulos que existen", () => {
    const chaptersByBook = new Map(BIBLE_BOOKS.map((book) => [book.name, book.chapters]));
    for (const ranges of Object.values(CHAPTER_VOICES)) {
      for (const item of ranges) {
        const chapters = chaptersByBook.get(item.book);
        expect(chapters, item.book).toBeDefined();
        expect(item.from).toBeGreaterThanOrEqual(1);
        expect(item.to).toBeGreaterThanOrEqual(item.from);
        expect(item.to).toBeLessThanOrEqual(chapters ?? 0);
      }
    }
  });

  it("un capítulo no se asigna a dos personajes", () => {
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
        const owners = Object.entries(CHAPTER_VOICES).filter(([, ranges]) =>
          ranges.some((item) => item.book === book.name && chapter >= item.from && chapter <= item.to),
        );
        expect(owners.length, `${book.name} ${chapter}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("voiceDraftFor", () => {
  it("cambia la pregunta según si lo vivió o lo escribió", () => {
    expect(voiceDraftFor("Éxodo 14:21", "vivio")).toBe("Estoy leyendo Éxodo 14:21. ¿Cómo viviste este momento?");
    expect(voiceDraftFor("Salmos 23:1", "escribio")).toBe("Estoy leyendo Salmos 23:1. ¿Qué te pasaba cuando escribiste esto?");
  });
});
