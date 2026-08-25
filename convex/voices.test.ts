import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { voiceCharacters } from "./voicesCatalog";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./voices.ts": () => import("./voices"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

const DIVINE_NAMES = ["Jesús", "Dios", "Espíritu Santo", "Cristo", "Jehová", "Yahvé"];

describe("voices.list", () => {
  it("devuelve todos los personajes del catálogo", async () => {
    const t = convexTest(schema, modules);
    const characters = await t.query(api.voices.list, {});
    expect(characters).toEqual(voiceCharacters);
  });

  it("solo incluye personajes humanos — nunca a Dios/Jesús/Espíritu Santo (regla dura #2)", async () => {
    const t = convexTest(schema, modules);
    const characters = await t.query(api.voices.list, {});
    for (const character of characters) {
      for (const divineName of DIVINE_NAMES) {
        expect(character.name).not.toContain(divineName);
      }
    }
  });
});
