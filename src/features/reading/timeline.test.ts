import { describe, expect, it } from "vitest";

import { STORY_CATALOG } from "../../../convex/stories";
import { TEXT_STORY_CATALOG } from "../../../convex/textStoriesCatalog";
import { voiceCharacters } from "../../../convex/voicesCatalog";
import { BIBLE_BOOKS } from "../../lib/bibleBooks";
import {
  TIMELINE_ERAS,
  bookRange,
  eraForChapter,
  eraFromParam,
  eraOverline,
  eraStories,
  eraVoices,
  timelineBookLabel,
} from "./timeline";

describe("línea del tiempo: datos", () => {
  it("tiene las épocas del issue, en orden", () => {
    expect(TIMELINE_ERAS.map((era) => era.id)).toEqual([
      "origenes",
      "patriarcas",
      "exodo",
      "jueces",
      "reino-unido",
      "reino-dividido",
      "exilio",
      "regreso",
      "vida-de-jesus",
      "iglesia-primitiva",
    ]);
  });

  it("los 66 libros aparecen en alguna época", () => {
    const placed = new Set(TIMELINE_ERAS.flatMap((era) => era.books.map((entry) => entry.book)));
    expect(BIBLE_BOOKS).toHaveLength(66);
    for (const book of BIBLE_BOOKS) {
      expect(placed.has(book.name), book.name).toBe(true);
    }
    // Y ningún nombre que no sea un libro del canon (un typo no pasa callado).
    const canon = new Set(BIBLE_BOOKS.map((book) => book.name));
    for (const name of placed) expect(canon.has(name), name).toBe(true);
  });

  it("cada capítulo de la Biblia cae en exactamente una época", () => {
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
        const owners = TIMELINE_ERAS.filter((era) =>
          era.books.some((entry) => {
            if (entry.book !== book.name) return false;
            const { from, to } = bookRange(entry);
            return chapter >= from && chapter <= to;
          }),
        );
        expect(owners.length, `${book.name} ${chapter}`).toBe(1);
      }
    }
  });

  it("los rangos de capítulos existen", () => {
    const chaptersByBook = new Map(BIBLE_BOOKS.map((book) => [book.name, book.chapters]));
    for (const era of TIMELINE_ERAS) {
      for (const entry of era.books) {
        const { from, to } = bookRange(entry);
        expect(from, entry.book).toBeGreaterThanOrEqual(1);
        expect(to, entry.book).toBeGreaterThanOrEqual(from);
        expect(to, entry.book).toBeLessThanOrEqual(chaptersByBook.get(entry.book) ?? 0);
      }
    }
  });

  it("todo slug de personaje existe en Voces y ninguno es Jesús, Dios o el Espíritu (regla dura #2)", () => {
    const slugs = new Set(voiceCharacters.map((item) => item.slug));
    const used = TIMELINE_ERAS.flatMap((era) => era.voices);
    for (const slug of used) expect(slugs.has(slug), slug).toBe(true);
    for (const forbidden of ["jesus", "dios", "espiritu-santo", "espiritu"]) {
      expect(used).not.toContain(forbidden);
    }
    expect(TIMELINE_ERAS.find((era) => era.id === "vida-de-jesus")?.voices).toEqual([]);
  });

  it("cada personaje de Voces vive en una sola época", () => {
    const used = TIMELINE_ERAS.flatMap((era) => era.voices);
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(new Set(voiceCharacters.map((item) => item.slug)));
  });

  it("todo id de historia existe en el catálogo en texto, y cada historia aparece una sola vez", () => {
    const ids = new Set(TEXT_STORY_CATALOG.map((story) => story.id));
    const used = TIMELINE_ERAS.flatMap((era) => era.stories);
    for (const id of used) expect(ids.has(id), id).toBe(true);
    expect(new Set(used).size).toBe(used.length);
    expect(new Set(used)).toEqual(ids);
  });

  it("cada historia cae en la época de su propio capítulo", () => {
    for (const era of TIMELINE_ERAS) {
      for (const id of era.stories) {
        const story = TEXT_STORY_CATALOG.find((item) => item.id === id)!;
        expect(eraForChapter(story.book, story.chapter)?.id, id).toBe(era.id);
      }
    }
  });

  it("cada historia ilustrada tiene su versión en texto en la línea", () => {
    const textReferences = new Set(
      TIMELINE_ERAS.flatMap((era) => eraStories(era)).map((story) => story.reference.split(":")[0]),
    );
    for (const story of STORY_CATALOG) {
      expect(textReferences.has(story.reference), story.id).toBe(true);
    }
  });

  it("los años son siempre aproximados", () => {
    for (const era of TIMELINE_ERAS) {
      if (era.years) expect(eraOverline(era)).toContain("(APROX.)");
    }
  });
});

describe("eraForChapter", () => {
  it("Rut 1 → Jueces (criterio de aceptación de #201)", () => {
    expect(eraForChapter("Rut", 1)?.id).toBe("jueces");
  });

  it("un libro que abarca varias épocas se resuelve por capítulo", () => {
    expect(eraForChapter("Génesis", 1)?.id).toBe("origenes");
    expect(eraForChapter("Génesis", 11)?.id).toBe("origenes");
    expect(eraForChapter("Génesis", 12)?.id).toBe("patriarcas");
    expect(eraForChapter("1 Samuel", 3)?.id).toBe("jueces");
    expect(eraForChapter("1 Samuel", 17)?.id).toBe("reino-unido");
    expect(eraForChapter("1 Reyes", 18)?.id).toBe("reino-dividido");
    expect(eraForChapter("2 Reyes", 25)?.id).toBe("exilio");
    expect(eraForChapter("2 Crónicas", 36)?.id).toBe("exilio");
  });

  it("ubica profetas, cartas y evangelios", () => {
    expect(eraForChapter("Salmos", 23)?.id).toBe("reino-unido");
    expect(eraForChapter("Daniel", 6)?.id).toBe("exilio");
    expect(eraForChapter("Malaquías", 4)?.id).toBe("regreso");
    expect(eraForChapter("Juan", 3)?.id).toBe("vida-de-jesus");
    expect(eraForChapter("Filipenses", 4)?.id).toBe("iglesia-primitiva");
    expect(eraForChapter("Apocalipsis", 22)?.id).toBe("iglesia-primitiva");
  });

  it("fuera del canon o del rango devuelve null", () => {
    expect(eraForChapter("Tobías", 1)).toBeNull();
    expect(eraForChapter("Rut", 5)).toBeNull();
  });
});

describe("presentación", () => {
  it("etiqueta un libro entero o un rango", () => {
    expect(timelineBookLabel({ book: "Job" })).toBe("Job");
    expect(timelineBookLabel({ book: "Génesis", from: 12, to: 50 })).toBe("Génesis 12–50");
    expect(timelineBookLabel({ book: "2 Crónicas", from: 36, to: 36 })).toBe("2 Crónicas 36");
  });

  it("encabezado con posición, y años solo si hay consenso", () => {
    const origenes = eraFromParam("origenes")!;
    const reino = eraFromParam("reino-unido")!;
    expect(eraOverline(origenes)).toBe("ÉPOCA 1 DE 10");
    expect(eraOverline(reino)).toBe("ÉPOCA 5 DE 10 · C. 1050–930 A.C. (APROX.)");
  });

  it("lee el parámetro de la ruta", () => {
    expect(eraFromParam("jueces")?.name).toBe("Los jueces");
    expect(eraFromParam(["exilio", "otro"])?.id).toBe("exilio");
    expect(eraFromParam("no-existe")).toBeNull();
    expect(eraFromParam(undefined)).toBeNull();
  });

  it("resuelve nombres de personajes e historias desde los catálogos", () => {
    const exodo = eraFromParam("exodo")!;
    expect(eraVoices(exodo)).toEqual([{ slug: "moises", name: "Moisés", tag: "Éxodo · el que dudó de sí mismo" }]);
    expect(eraStories(exodo)[0]).toEqual({ id: "nacimiento-de-moises", title: expect.any(String), reference: "Éxodo 1–2" });
  });
});
