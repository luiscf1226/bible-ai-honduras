import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import schema from "./schema";
import { STORY_CATALOG, type StoryCatalogItem } from "./stories";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./stories.ts": () => import("./stories"),
};

// El deployment aún no está configurado en este worktree, por lo que Convex no
// puede regenerar `api`. Estas referencias prueban el mismo contrato público
// sin modificar archivos generados a mano.
const listStories = makeFunctionReference<"query", Record<string, never>, readonly StoryCatalogItem[]>(
  "stories:list",
);
const getStoryById = makeFunctionReference<"query", { storyId: string }, StoryCatalogItem | null>(
  "stories:getById",
);

describe("catálogo de historias", () => {
  it("incluye al menos cinco historias y tres o más escenas completas por historia", () => {
    expect(STORY_CATALOG.length).toBeGreaterThanOrEqual(5);

    for (const story of STORY_CATALOG) {
      expect(story.id).toMatch(/^[a-z0-9-]+$/);
      expect(story.title).not.toHaveLength(0);
      expect(story.reference).not.toHaveLength(0);
      expect(story.scenes.length).toBeGreaterThanOrEqual(3);
      expect(story.scenes.map((scene) => scene.order)).toEqual(
        Array.from({ length: story.scenes.length }, (_, index) => index + 1),
      );

      for (const scene of story.scenes) {
        expect(scene.id).toMatch(new RegExp(`^${story.id}-\\d+$`));
        expect(scene.title).not.toHaveLength(0);
        expect(scene.narration).not.toHaveLength(0);
        expect(scene.reference).not.toHaveLength(0);
        expect(scene.imagePrompt).toContain("No written text");
        expect(scene.imagePrompt).toContain("No written text, captions, watermarks");
      }
    }
  });
});

describe("stories.list", () => {
  it("expone el catálogo completo sin requerir una sesión", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(listStories, {})).resolves.toEqual(STORY_CATALOG);
  });
});

describe("stories.getById", () => {
  it("devuelve el desglose listo para generar de una historia conocida", async () => {
    const t = convexTest(schema, modules);

    const story = await t.query(getStoryById, { storyId: "el-mar-rojo-se-abre" });

    expect(story).toMatchObject({
      id: "el-mar-rojo-se-abre",
      reference: "Éxodo 14",
    });
    expect(story?.scenes).toHaveLength(4);
    expect(story?.scenes[2]).toMatchObject({
      order: 3,
      reference: "Éxodo 14:21–22",
    });
  });

  it("devuelve null para un identificador que no está en el catálogo", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(getStoryById, { storyId: "no-existe" })).resolves.toBeNull();
  });
});
