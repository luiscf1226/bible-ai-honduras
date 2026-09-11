import { beforeEach, describe, expect, it, vi } from "vitest";

import { shareContent } from "../../lib/share";
import { buildStoryShareText, shareStory } from "./storyShare";

vi.mock("../../lib/share", () => ({
  shareContent: vi.fn(),
}));

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

describe("shareStory", () => {
  const STORY = { reference: "Éxodo 14", scenes: [{}, {}, {}, {}], title: "El mar que se abrió" };

  beforeEach(() => {
    vi.mocked(shareContent).mockReset();
  });

  it("invoca shareContent con el texto editorial de la historia y el referralCode del usuario", async () => {
    vi.mocked(shareContent).mockResolvedValue({ status: "shared" });

    await shareStory({ referralCode: "BAH-TEST01", story: STORY });

    expect(shareContent).toHaveBeenCalledWith({
      referralCode: "BAH-TEST01",
      text: buildStoryShareText(STORY),
    });
  });

  // #103: shareStory ya no se traga el resultado de shareContent — lo devuelve tal
  // cual para que quien la invoque pueda distinguir cancelación de error real.
  it("devuelve el resultado de shareContent sin envolverlo ni tragárselo", async () => {
    vi.mocked(shareContent).mockResolvedValue({ status: "dismissed" });

    const result = await shareStory({ referralCode: "BAH-TEST01", story: STORY });

    expect(result).toEqual({ status: "dismissed" });
  });
});
