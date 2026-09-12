import { beforeEach, describe, expect, it, vi } from "vitest";

import { shareContent } from "../../lib/share";
import { buildVerseCopyText, buildVerseShareText, shareVerse } from "./shareVerse";

vi.mock("../../lib/share", () => ({ shareContent: vi.fn() }));

const verse = {
  book: "Juan",
  chapter: 3,
  verse: 16,
  version: "RV1909",
  text: "Porque de tal manera amó Dios al mundo",
};

describe("acciones de versículo del lector (#113)", () => {
  beforeEach(() => vi.mocked(shareContent).mockReset());

  it("construye el mismo texto para copiar y compartir", () => {
    expect(buildVerseShareText(verse)).toBe('"Porque de tal manera amó Dios al mundo"\n— Juan 3:16 (RV1909)');
    expect(buildVerseCopyText(verse)).toBe(buildVerseShareText(verse));
  });

  it("delegar compartir al único dueño shareContent", async () => {
    vi.mocked(shareContent).mockResolvedValue({ status: "shared" });

    await expect(shareVerse({ verse, referralCode: "BAH-LECTURA" })).resolves.toEqual({ status: "shared" });
    expect(shareContent).toHaveBeenCalledWith({
      referralCode: "BAH-LECTURA",
      text: buildVerseShareText(verse),
    });
  });
});
