import { describe, expect, it } from "vitest";

import { buildStoryShareText } from "./storyShare";

describe("buildStoryShareText", () => {
  it("incluye los datos reales de la historia que se está viendo", () => {
    expect(
      buildStoryShareText({
        title: "El mar que se abrió",
        reference: "Éxodo 14",
        scenes: [{}, {}, {}, {}],
      }),
    ).toBe("El mar que se abrió — en 4 escenas ilustradas.\nÉxodo 14 · Historia ilustrada · Bible AI");
  });
});
