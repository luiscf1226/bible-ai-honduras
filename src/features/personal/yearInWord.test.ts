import { afterEach, describe, expect, it } from "vitest";

import { resetShareNativeForTests, setShareNativeForTests } from "../../lib/share";
import {
  buildYearInWordShareText,
  isYearInWordEmpty,
  shareYearInWord,
  topHighlightCaption,
  yearInWordEntry,
  yearInWordRows,
  type YearInWordSummary,
} from "./yearInWord";

const FULL: YearInWordSummary = {
  year: 2026,
  chaptersRead: 48,
  planDays: 1,
  savedVerses: 12,
  topHighlight: {
    book: "Salmos",
    chapter: 46,
    verse: 1,
    chapterCount: 3,
    version: "RV1909",
    text: "Dios es nuestro amparo y fortaleza,",
  },
};

const EMPTY: YearInWordSummary = { year: 2026, chaptersRead: 0, planDays: 0, savedVerses: 0, topHighlight: null };

afterEach(() => resetShareNativeForTests());

describe("entrada en Mi espacio (#183)", () => {
  it("aparece en diciembre y enero, con el año que resume", () => {
    expect(yearInWordEntry("2026-12-01")).toMatchObject({ year: 2026, title: "Tu 2026 en la Palabra" });
    expect(yearInWordEntry("2027-01-31")).toMatchObject({ year: 2026, title: "Tu 2026 en la Palabra" });
  });

  it("el resto del año no se ofrece", () => {
    expect(yearInWordEntry("2026-10-02")).toBeNull();
    expect(yearInWordEntry("2026-11-30")).toBeNull();
    expect(yearInWordEntry("2027-02-01")).toBeNull();
  });
});

describe("cuentas de la pantalla", () => {
  it("singular y plural, sin ranking ni comparaciones", () => {
    expect(yearInWordRows(FULL)).toEqual([
      { id: "chapters", label: "Capítulos leídos", value: 48 },
      { id: "planDays", label: "Día del plan cumplido", value: 1 },
      { id: "saved", label: "Versículos guardados", value: 12 },
    ]);
    expect(topHighlightCaption(FULL.topHighlight!)).toBe("3 versículos subrayados en Salmos 46");
    expect(topHighlightCaption({ ...FULL.topHighlight!, chapterCount: 1 })).toBe("1 versículo subrayado en Salmos 46");
  });

  it("vacío solo si no hay nada de nada", () => {
    expect(isYearInWordEmpty(EMPTY)).toBe(true);
    expect(isYearInWordEmpty({ ...EMPTY, planDays: 1 })).toBe(false);
    expect(isYearInWordEmpty(FULL)).toBe(false);
  });
});

describe("compartir", () => {
  it("lleva las cuentas y el versículo, y omite lo que está en cero", () => {
    expect(buildYearInWordShareText({ ...FULL, planDays: 0 })).toBe(
      [
        "Mi 2026 en la Palabra:",
        "· 48 capítulos leídos",
        "· 12 versículos guardados",
        "",
        "El que más subrayé: “Dios es nuestro amparo y fortaleza,”",
        "— Salmos 46:1 (RV1909)",
      ].join("\n"),
    );
  });

  it("sin texto en el corpus no inventa el versículo", () => {
    const text = buildYearInWordShareText({ ...FULL, topHighlight: { ...FULL.topHighlight!, text: null } });
    expect(text).not.toContain("subrayé");
  });

  it("nunca manda notas ni Sentir: solo campos del resumen", () => {
    // Aunque llegaran campos de más, el texto se arma solo con los conocidos.
    const leaky = { ...FULL, note: "mi nota privada", feelings: ["ansiedad"] } as YearInWordSummary;
    const text = buildYearInWordShareText(leaky);
    expect(text).not.toContain("nota");
    expect(text).not.toContain("ansiedad");
  });

  it("pasa por el share sheet único con el código de referido", async () => {
    const sent: string[] = [];
    setShareNativeForTests({
      dismissedAction: "dismissedAction",
      share: async ({ message }) => {
        sent.push(message);
        return { action: "sharedAction" };
      },
    });
    await expect(shareYearInWord({ summary: FULL, referralCode: "BAH-12AB34C" })).resolves.toEqual({ status: "shared" });
    expect(sent[0]).toContain("Mi 2026 en la Palabra:");
    expect(sent[0]).toContain("?ref=BAH-12AB34C");
  });
});
