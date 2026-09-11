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
    vi.mocked(shareContent).mockResolvedValue({ status: "shared" });

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

  // #103: shareVoiceReply ya no se traga el resultado de shareContent — lo devuelve
  // tal cual para que quien la invoque pueda distinguir cancelación de error real.
  it("devuelve el resultado de shareContent sin envolverlo ni tragárselo", async () => {
    vi.mocked(shareContent).mockResolvedValue({ error: new Error("boom"), status: "error" });

    const result = await shareVoiceReply({
      characterName: "Moisés",
      referralCode: "BAH-TEST01",
      reply: "Yo no quería ir.",
    });

    expect(result.status).toBe("error");
  });
});
