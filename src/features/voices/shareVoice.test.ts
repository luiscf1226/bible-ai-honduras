import { beforeEach, describe, expect, it, vi } from "vitest";

import { shareContent } from "../../lib/share";
import { buildVoiceShareText, shareVoiceReply } from "./shareVoice";

vi.mock("../../lib/share", () => ({
  shareContent: vi.fn(),
}));

describe("buildVoiceShareText", () => {
  it("incluye el nombre del personaje y la respuesta", () => {
    const text = buildVoiceShareText("Moisés", "Yo no quería ir. El camino se abrió mientras caminaba.");
    expect(text).toContain("Moisés");
    expect(text).toContain("Yo no quería ir. El camino se abrió mientras caminaba.");
  });
});

describe("shareVoiceReply", () => {
  beforeEach(() => {
    vi.mocked(shareContent).mockReset();
  });

  it("invoca shareContent con la cita y el referralCode del usuario", async () => {
    await shareVoiceReply({
      characterName: "Moisés",
      referralCode: "BAH-TEST01",
      reply: "Yo no quería ir.",
    });

    expect(shareContent).toHaveBeenCalledWith({
      referralCode: "BAH-TEST01",
      text: buildVoiceShareText("Moisés", "Yo no quería ir."),
    });
  });
});
