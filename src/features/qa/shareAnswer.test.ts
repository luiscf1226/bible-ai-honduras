import { beforeEach, describe, expect, it, vi } from "vitest";

import { shareContent } from "../../lib/share";
import { buildQaShareText, shareQaAnswer } from "./shareAnswer";

vi.mock("../../lib/share", () => ({
  shareContent: vi.fn(),
}));

const CITATION = { book: "Salmos", chapter: 23, verse: 1, version: "RVR1960", text: "Jehová es mi pastor; nada me faltará." };

describe("buildQaShareText", () => {
  it("incluye la pregunta, el texto citado y la referencia", () => {
    const text = buildQaShareText("¿Quién es mi pastor?", CITATION);
    expect(text).toContain("¿Quién es mi pastor?");
    expect(text).toContain("Jehová es mi pastor; nada me faltará.");
    expect(text).toContain("Salmos 23:1 (RVR1960)");
  });
});

describe("shareQaAnswer", () => {
  beforeEach(() => {
    vi.mocked(shareContent).mockReset();
  });

  it("invoca shareContent con la pregunta+cita y el referralCode del usuario", async () => {
    await shareQaAnswer({ question: "¿Quién es mi pastor?", citation: CITATION, referralCode: "BAH-TEST01" });

    expect(shareContent).toHaveBeenCalledWith({
      referralCode: "BAH-TEST01",
      text: buildQaShareText("¿Quién es mi pastor?", CITATION),
    });
  });
});
