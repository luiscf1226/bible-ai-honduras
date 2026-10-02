import { describe, expect, it } from "vitest";

import { findReadingPlan } from "../../../convex/readingPlanCatalog";
import { findTextStoryById } from "../../../convex/textStoriesCatalog";
import { voiceCharacters } from "../../../convex/voicesCatalog";
import { isChapterInBook } from "../reading/bookSearch";
import { FEATURED_CHARACTERS, featuredShortcuts, MONTHLY_ROTATION, pickFeaturedCharacter } from "./featuredCharacter";

const VOICE_SLUGS = voiceCharacters.map((character) => character.slug);

describe("catálogo del personaje del mes (#200)", () => {
  it("solo contiene slugs humanos de voicesCatalog (regla dura #2)", () => {
    for (const slug of Object.keys(FEATURED_CHARACTERS)) {
      expect(VOICE_SLUGS).toContain(slug);
      expect(slug).not.toMatch(/jesus|cristo|dios|espiritu|senor/);
    }
  });

  it("cada personaje de Voces tiene su tarjeta curada", () => {
    expect([...MONTHLY_ROTATION].sort()).toEqual([...VOICE_SLUGS].sort());
  });

  it("las historias, capítulos y recorridos existen en sus catálogos", () => {
    for (const [slug, content] of Object.entries(FEATURED_CHARACTERS)) {
      expect(content.line.length, slug).toBeGreaterThan(0);
      if (content.storyId) {
        const story = findTextStoryById(content.storyId);
        expect(story, `${slug}: ${content.storyId}`).not.toBeNull();
        // La historia es de ese personaje cuando el catálogo lo dice.
        if (story?.voiceSlug) expect(story.voiceSlug).toBe(slug);
      }
      expect(isChapterInBook(content.chapter.book, content.chapter.chapter), `${slug}: capítulo`).toBe(true);
      if (content.planId) expect(findReadingPlan(content.planId), `${slug}: ${content.planId}`).not.toBeNull();
    }
  });
});

describe("pickFeaturedCharacter", () => {
  it("con temporada, el personaje de la temporada", () => {
    expect(pickFeaturedCharacter({ characterSlug: "pablo" }, "2026-10-02")?.slug).toBe("pablo");
    expect(pickFeaturedCharacter({ characterSlug: "rut" }, "2026-10-31")?.content).toBe(FEATURED_CHARACTERS.rut);
  });

  it("sin temporada (o sin personaje), rota por mes y cambia el día 1", () => {
    const october = pickFeaturedCharacter(null, "2026-10-01")?.slug;
    expect(pickFeaturedCharacter(null, "2026-10-31")?.slug).toBe(october);
    expect(pickFeaturedCharacter({ characterSlug: null }, "2026-10-15")?.slug).toBe(october);
    expect(pickFeaturedCharacter(null, "2026-11-01")?.slug).not.toBe(october);
  });

  it("la rotación recorre a todos antes de repetir, también al cambiar de año", () => {
    const months = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"];
    const slugs = months.map((month) => pickFeaturedCharacter(null, `${month}-15`)?.slug);
    expect(new Set(slugs.slice(0, MONTHLY_ROTATION.length)).size).toBe(MONTHLY_ROTATION.length);
    expect(slugs[MONTHLY_ROTATION.length]).toBe(slugs[0]);
  });

  it("un slug de temporada desconocido o no humano cae a la rotación", () => {
    const rotation = pickFeaturedCharacter(null, "2026-12-10")?.slug;
    expect(pickFeaturedCharacter({ characterSlug: "jesus" }, "2026-12-10")?.slug).toBe(rotation);
    expect(pickFeaturedCharacter({ characterSlug: "constructor" }, "2026-12-10")?.slug).toBe(rotation);
    expect(MONTHLY_ROTATION).toContain(rotation);
  });
});

describe("atajos de la tarjeta", () => {
  it("van en el orden del spec y omiten lo que no existe", () => {
    expect(featuredShortcuts(FEATURED_CHARACTERS.moises).map((s) => s.label)).toEqual(["Su historia", "Capítulos", "Conversar"]);
    expect(
      featuredShortcuts({ line: "x", storyId: "jose-en-egipto", planId: "vida-de-jose", chapter: { book: "Génesis", chapter: 37 } }).map(
        (s) => s.id,
      ),
    ).toEqual(["historia", "capitulos", "recorrido", "conversar"]);
    expect(featuredShortcuts({ line: "x", chapter: { book: "Rut", chapter: 1 } }).map((s) => s.id)).toEqual(["capitulos", "conversar"]);
  });
});
