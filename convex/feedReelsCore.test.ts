import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import {
  buildStoryReels,
  CHARACTER_VOICE_SLUGS,
  FEED_TEXT_MAX,
  feedReel,
  NARRATOR_VOICE,
  passageOf,
  rankReels,
  REEL_POOL,
  reelScene,
  reelVoice,
  splitPageReference,
  type FeedReel,
} from "./feedReelsCore";
import { STORY_CATALOG } from "./storyCatalog";
import { TEXT_STORY_CATALOG } from "./textStoriesCatalog";
import { assistantSpeaksAsDivine } from "./voicesGuardrail";
import { voiceCharacters } from "./voicesCatalog";

const BOOKS = new Map(BIBLE_BOOKS.map((book) => [book.name, book]));
const stories = REEL_POOL.filter((reel) => reel.kind === "story");
const characters = REEL_POOL.filter((reel) => reel.kind === "character");

describe("catálogo de reels", () => {
  it("trae todas las historias una sola vez: las ilustradas y las en texto sin gemela ilustrada", () => {
    expect(stories.length).toBe(TEXT_STORY_CATALOG.length);
    for (const story of STORY_CATALOG) expect(feedReel(`historia:${story.id}`)).not.toBeNull();
    // Las gemelas en texto de una ilustrada no se repiten.
    expect(feedReel("historia:daniel-en-el-foso")).toBeNull();
    expect(new Set(REEL_POOL.map((reel) => reel.ref)).size).toBe(REEL_POOL.length);
  });

  it("cada personaje con monólogos es un personaje humano de Voces y tiene su propia voz", () => {
    const slugs = new Set(voiceCharacters.map((character) => character.slug));
    expect(characters.length).toBeGreaterThanOrEqual(slugs.size);
    for (const reel of characters) {
      expect(slugs.has(reel.voiceSlug ?? "")).toBe(true);
      expect(CHARACTER_VOICE_SLUGS).toContain(reel.voiceSlug);
      expect(reelVoice(reel).voice).not.toBe(NARRATOR_VOICE.voice);
    }
    // Cada personaje del catálogo tiene al menos un monólogo.
    for (const slug of slugs) expect(characters.some((reel) => reel.voiceSlug === slug)).toBe(true);
  });

  it("regla dura #2: ningún monólogo habla como Dios, Jesús o el Espíritu Santo", () => {
    for (const reel of characters) {
      const [scene] = reel.scenes;
      expect(assistantSpeaksAsDivine(scene.text), reel.ref).toBe(false);
      // Lo que dijeron Dios o Jesús va en estilo indirecto: nunca en 1ra persona entre comillas.
      expect(scene.text, reel.ref).not.toMatch(/«[^»]*\b(yo soy|mi gracia|me persigues)\b[^»]*»/iu);
    }
  });

  it("todo texto entra en una pantalla y toda escena abre un capítulo real", () => {
    for (const reel of REEL_POOL) {
      expect(reel.scenes.length, reel.ref).toBeGreaterThan(0);
      for (const scene of reel.scenes) {
        expect(scene.text.length, scene.mediaRef).toBeLessThanOrEqual(FEED_TEXT_MAX);
        expect(scene.text.trim(), scene.mediaRef).not.toBe("");
        const book = BOOKS.get(scene.book);
        expect(book, `${scene.mediaRef}: ${scene.book}`).toBeDefined();
        expect(scene.chapter).toBeGreaterThanOrEqual(1);
        expect(scene.chapter).toBeLessThanOrEqual(book!.chapters);
        expect(scene.reference).not.toBe("");
      }
      expect(reel.fallbackImageUrl).toMatch(/^https:\/\//);
    }
  });

  it("la voz no lee la cita: ningún texto termina con la referencia entre paréntesis", () => {
    for (const reel of stories) {
      for (const scene of reel.scenes) expect(scene.text, scene.mediaRef).not.toMatch(/\(\s*[^()]*\d[^()]*\)\s*\.?$/u);
    }
  });

  it("los prompts de las imágenes prohíben texto y figuras de Jesús, Dios o el Espíritu Santo", () => {
    for (const reel of REEL_POOL) {
      for (const scene of reel.scenes) {
        expect(scene.imagePrompt).toContain("No written text");
        expect(scene.imagePrompt).toContain("Never depict Jesus, God or the Holy Spirit");
        expect(scene.imagePrompt).toContain("Vertical 2:3");
      }
    }
  });

  it("cada escena se encuentra por su id de medios", () => {
    for (const reel of REEL_POOL) {
      for (const [index, scene] of reel.scenes.entries()) {
        expect(scene.mediaRef).toBe(`${reel.ref}#${index + 1}`);
        expect(reelScene(scene.mediaRef)).toEqual({ reel, scene });
      }
    }
    expect(reelScene("historia:no-existe#1")).toBeNull();
  });

  it("las historias contadas usan la voz del narrador", () => {
    for (const reel of stories) expect(reelVoice(reel)).toBe(NARRATOR_VOICE);
  });

  it("una historia ilustrada hereda el personaje de Voces de su gemela en texto", () => {
    expect(feedReel("historia:el-mar-rojo-se-abre")?.voiceSlug).toBe("moises");
    expect(feedReel("historia:arca-de-noe")?.voiceSlug).toBeNull();
  });

  it("sin historias ilustradas, todas las en texto entran", () => {
    expect(buildStoryReels([], TEXT_STORY_CATALOG).length).toBe(TEXT_STORY_CATALOG.length - 5);
  });
});

describe("la cita de cada página", () => {
  it("se separa del texto y el punto vuelve al final de la frase", () => {
    expect(splitPageReference("Lo acostó en un pesebre (Lucas 2:1–7).")).toEqual({
      text: "Lo acostó en un pesebre.",
      reference: "Lucas 2:1–7",
    });
    expect(splitPageReference("Jesús: «Hoy estarás conmigo en el paraíso» (Lucas 23:33–43).")).toEqual({
      text: "Jesús: «Hoy estarás conmigo en el paraíso».",
      reference: "Lucas 23:33–43",
    });
  });

  it("una página sin cita va entera", () => {
    expect(splitPageReference("El relato advierte contra el orgullo.")).toEqual({
      text: "El relato advierte contra el orgullo.",
      reference: null,
    });
  });

  it("entiende el capítulo y el versículo de una cita editorial", () => {
    expect(passageOf("Lucas 2:1–7")).toEqual({ book: "Lucas", chapter: 2, verse: 1 });
    expect(passageOf("1 Samuel 17")).toEqual({ book: "1 Samuel", chapter: 17, verse: null });
    expect(passageOf("Génesis 25; 27; 33")).toEqual({ book: "Génesis", chapter: 25, verse: null });
    expect(passageOf("Libro 3:1")).toBeNull();
    expect(passageOf("Rut 9:1")).toBeNull();
  });
});

describe("orden de los reels", () => {
  const base = { communityLikes: new Map<string, number>(), likedRefs: [], seenRefs: [] as string[] };

  it("alterna historia y personaje, sin repetir personaje en la tanda", () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const reels = rankReels({ ...base, count: 4, pool: REEL_POOL, seed });
      expect(reels).toHaveLength(4);
      for (let index = 1; index < reels.length; index += 1) expect(reels[index].kind).not.toBe(reels[index - 1].kind);
      const slugs = reels.filter((reel) => reel.kind === "character").map((reel) => reel.voiceSlug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("es determinístico por semilla y cambia con otra", () => {
    const refs = (seed: number) => rankReels({ ...base, count: 2, pool: REEL_POOL, seed }).map((reel) => reel.ref);
    expect(refs(7)).toEqual(refs(7));
    const different = Array.from({ length: 10 }, (_, seed) => refs(seed).join()).filter(
      (value) => value !== refs(7).join(),
    );
    expect(different.length).toBeGreaterThan(0);
  });

  it("no repite lo ya visto, y cuando se vio todo vuelven sin los últimos", () => {
    const seen: string[] = [];
    for (let page = 0; page < Math.floor(REEL_POOL.length / 2); page += 1) {
      const reels = rankReels({ ...base, count: 2, pool: REEL_POOL, seed: page, seenRefs: seen });
      for (const reel of reels) expect(seen).not.toContain(reel.ref);
      seen.push(...reels.map((reel) => reel.ref));
    }
    const recent = seen.slice(-24);
    const next = rankReels({
      ...base,
      count: 2,
      pool: REEL_POOL.filter((reel) => seen.includes(reel.ref)),
      seed: 1,
      seenRefs: seen,
    });
    expect(next).toHaveLength(2);
    for (const reel of next) expect(recent).not.toContain(reel.ref);
  });

  it("sube lo que más quiere la comunidad", () => {
    const loved = characters[3];
    const communityLikes = new Map([[loved.ref, 500]]);
    let first = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const reels = rankReels({ ...base, communityLikes, count: 2, pool: REEL_POOL, seed });
      if (reels.some((reel: FeedReel) => reel.ref === loved.ref)) first += 1;
    }
    expect(first).toBeGreaterThan(20);
  });

  it("con un catálogo vacío o sin lugares, no devuelve nada", () => {
    expect(rankReels({ ...base, count: 2, pool: [], seed: 1 })).toEqual([]);
    expect(rankReels({ ...base, count: 0, pool: REEL_POOL, seed: 1 })).toEqual([]);
  });
});
