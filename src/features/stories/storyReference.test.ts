import { describe, expect, it } from "vitest";

import { STORY_CATALOG } from "../../../convex/stories";
import { parseStoryReference } from "./storyReference";

describe("parseStoryReference — referencias reales del catálogo de historias", () => {
  const scenes = STORY_CATALOG.flatMap((story) => story.scenes.map((scene) => [story.id, scene.id, scene.reference] as const));

  it("el catálogo tiene escenas para probar", () => {
    expect(scenes.length).toBeGreaterThan(0);
  });

  it.each(scenes)("%s / %s: \"%s\" abre un capítulo real en su versículo", (_storyId, _sceneId, reference) => {
    const passage = parseStoryReference(reference);
    expect(passage, `no parsea: ${reference}`).not.toBeNull();
    const [, book, chapter, verse] = reference.match(/^(.+?)\s+(\d+):(\d+)/) ?? [];
    expect(passage).toEqual({ book, chapter: Number(chapter), verse: Number(verse) });
  });

  it.each(STORY_CATALOG.map((story) => [story.id, story.reference] as const))(
    "%s: la referencia de la historia completa (\"%s\") también resuelve",
    (_storyId, reference) => {
      expect(parseStoryReference(reference)).not.toBeNull();
    },
  );
});

describe("parseStoryReference — casos puntuales", () => {
  it("un rango de versículos con raya abre en el primer versículo", () => {
    expect(parseStoryReference("Génesis 6:13–22")).toEqual({ book: "Génesis", chapter: 6, verse: 13 });
  });

  it("un versículo suelto", () => {
    expect(parseStoryReference("Daniel 6:10")).toEqual({ book: "Daniel", chapter: 6, verse: 10 });
  });

  it("un rango de capítulos abre el primero", () => {
    expect(parseStoryReference("Ester 4–8")).toEqual({ book: "Ester", chapter: 4 });
  });

  it("un capítulo suelto con libro numerado", () => {
    expect(parseStoryReference("1 Samuel 17")).toEqual({ book: "1 Samuel", chapter: 17 });
  });

  it("acepta guion común y espacios alrededor de la raya", () => {
    expect(parseStoryReference("Éxodo 14:5 - 10")).toEqual({ book: "Éxodo", chapter: 14, verse: 5 });
  });

  it("null si el libro no existe, el capítulo se sale del libro o el texto no es una referencia", () => {
    expect(parseStoryReference("Hezequías 3:1")).toBeNull();
    expect(parseStoryReference("Daniel 13:1")).toBeNull();
    expect(parseStoryReference("Ester 11–12")).toBeNull();
    expect(parseStoryReference("una historia")).toBeNull();
    expect(parseStoryReference("")).toBeNull();
  });
});
