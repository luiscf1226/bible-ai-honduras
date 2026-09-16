import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";

import schema from "./schema";
import {
  findTextStoryById,
  summarizeTextStory,
  TEXT_STORY_CATALOG,
  type TextStoryCatalogItem,
  type TextStoryListItem,
} from "./textStoriesCatalog";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./textStories.ts": () => import("./textStories"),
  "./textStoriesCatalog.ts": () => import("./textStoriesCatalog"),
};

const listTextStories = makeFunctionReference<"query", Record<string, never>, readonly TextStoryListItem[]>(
  "textStories:list",
);
const getTextStory = makeFunctionReference<"query", { storyId: string }, TextStoryCatalogItem | null>(
  "textStories:getById",
);

describe("catálogo de historias en texto", () => {
  it("cubre Antiguo y Nuevo Testamento con 2–3 páginas y ids estables", () => {
    expect(TEXT_STORY_CATALOG.length).toBeGreaterThanOrEqual(40);

    const testaments = new Set(TEXT_STORY_CATALOG.map((story) => story.testament));
    expect(testaments.has("antiguo")).toBe(true);
    expect(testaments.has("nuevo")).toBe(true);

    for (const story of TEXT_STORY_CATALOG) {
      expect(story.id).toMatch(/^[a-z0-9-]+$/);
      expect(story.pages.length).toBeGreaterThanOrEqual(2);
      expect(story.pages.length).toBeLessThanOrEqual(3);
      expect(story.reference.length).toBeGreaterThan(0);
      expect(story.book.length).toBeGreaterThan(0);
      expect(story.chapter).toBeGreaterThan(0);
    }
  });

  it("encuentra por id y devuelve null si no existe", () => {
    expect(findTextStoryById("david-y-goliat")?.title).toBe("David y Goliat");
    expect(findTextStoryById("no-existe")).toBeNull();
  });

  it("mapea voiceSlug solo a personajes humanos conocidos cuando aparece", () => {
    const withVoice = TEXT_STORY_CATALOG.filter((story) => story.voiceSlug);
    expect(withVoice.length).toBeGreaterThan(0);
    for (const story of withVoice) {
      expect(story.voiceSlug).toMatch(/^(moises|david|ester|pablo|rut|elias)$/);
    }
  });
});

describe("textStories.list / getById", () => {
  it("expone el catálogo sin sesión, solo con metadatos", async () => {
    const t = convexTest(schema, modules);
    const listed = await t.query(listTextStories, {});

    expect(listed).toEqual(TEXT_STORY_CATALOG.map(summarizeTextStory));
    expect(listed.map((story) => story.id)).toEqual(TEXT_STORY_CATALOG.map((story) => story.id));
    for (const story of listed) {
      expect(story).not.toHaveProperty("pages");
      expect(story.pageCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("la lista es mucho más liviana que el catálogo completo", async () => {
    const t = convexTest(schema, modules);
    const listed = await t.query(listTextStories, {});

    const listedBytes = JSON.stringify(listed).length;
    const fullBytes = JSON.stringify(TEXT_STORY_CATALOG).length;
    expect(listedBytes).toBeLessThan(fullBytes / 4);
  });

  it("devuelve detalle o null", async () => {
    const t = convexTest(schema, modules);
    const story = await t.query(getTextStory, { storyId: "el-mar-rojo-se-abre" });
    expect(story?.pages).toHaveLength(3);
    await expect(t.query(getTextStory, { storyId: "fantasma" })).resolves.toBeNull();
  });
});
