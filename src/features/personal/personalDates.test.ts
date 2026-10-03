import { describe, expect, it } from "vitest";

import {
  birthdayFromDraft,
  describeBirthday,
  describeFaithDate,
  draftFromBirthday,
  draftFromFaithDate,
  faithDateFromDraft,
  firstName,
  occasionOverline,
  occasionTitle,
} from "./personalDates";

describe("textos de Tus fechas", () => {
  it("saluda por el primer nombre, o sin nombre si no hay", () => {
    const birthday = { kind: "cumpleanos", verseRef: "Salmos 139:14" } as const;
    expect(occasionTitle(birthday, "Ana María López")).toBe("Feliz cumpleaños, Ana");
    expect(occasionTitle(birthday, "  ")).toBe("Feliz cumpleaños");
    expect(occasionTitle(birthday, undefined)).toBe("Feliz cumpleaños");
    expect(firstName(null)).toBeNull();
  });

  it("dice los años del bautismo o la conversión, en singular cuando es uno", () => {
    expect(occasionTitle({ kind: "bautismo", years: 3, verseRef: "Romanos 6:4" })).toBe("Hoy hace 3 años de tu bautismo");
    expect(occasionTitle({ kind: "conversion", years: 1, verseRef: "Romanos 6:4" })).toBe("Hoy hace 1 año de tu conversión");
    expect(occasionOverline({ kind: "conversion", years: 1, verseRef: "Romanos 6:4" })).toBe("Tu conversión");
    expect(occasionOverline({ kind: "cumpleanos", verseRef: "Salmos 139:14" })).toBe("Tu cumpleaños");
  });

  it("describe las fechas guardadas en español", () => {
    expect(describeBirthday("03-14")).toBe("14 de marzo");
    expect(describeBirthday(undefined)).toBeNull();
    expect(describeFaithDate("2019-12-01")).toBe("1 de diciembre de 2019");
    expect(describeFaithDate("mal")).toBeNull();
  });
});

describe("formulario de Mi espacio", () => {
  it("cumpleaños: día y mes, con el 29 de febrero permitido", () => {
    expect(birthdayFromDraft({ day: "29", month: 2, year: "" })).toEqual({ ok: true, value: "02-29" });
    expect(birthdayFromDraft({ day: "5", month: 11, year: "" })).toEqual({ ok: true, value: "11-05" });
    expect(birthdayFromDraft({ day: "30", month: 2, year: "" })).toEqual({ ok: false, error: "Ese día no existe en febrero." });
    expect(birthdayFromDraft({ day: "", month: 2, year: "" }).ok).toBe(false);
    expect(birthdayFromDraft({ day: "4", month: null, year: "" })).toEqual({ ok: false, error: "Elegí el mes." });
  });

  it("bautismo: fecha completa, que exista ese año y que no sea después de hoy", () => {
    const today = "2026-10-02";
    expect(faithDateFromDraft({ day: "29", month: 2, year: "2020" }, today)).toEqual({ ok: true, value: "2020-02-29" });
    expect(faithDateFromDraft({ day: "29", month: 2, year: "2021" }, today).ok).toBe(false);
    expect(faithDateFromDraft({ day: "2", month: 10, year: "2026" }, today)).toEqual({ ok: true, value: "2026-10-02" });
    expect(faithDateFromDraft({ day: "3", month: 10, year: "2026" }, today)).toEqual({
      ok: false,
      error: "La fecha no puede ser después de hoy.",
    });
    expect(faithDateFromDraft({ day: "3", month: 10, year: "26" }, today)).toEqual({
      ok: false,
      error: "Escribí el año con cuatro números.",
    });
  });

  it("lo guardado vuelve al formulario para editarlo", () => {
    expect(draftFromBirthday("02-29")).toEqual({ day: "29", month: 2, year: "" });
    expect(draftFromBirthday(undefined)).toEqual({ day: "", month: null, year: "" });
    expect(draftFromFaithDate("2019-12-01")).toEqual({ day: "1", month: 12, year: "2019" });
  });
});
