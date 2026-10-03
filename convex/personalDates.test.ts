import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import { parseVerseRef } from "../src/lib/parseVerseRef";
import {
  BIRTHDAY_VERSES,
  FAITH_VERSES,
  isLeapYear,
  localDateKey,
  observedDay,
  occasionsOn,
  parseBirthday,
  parseCalendarDate,
} from "./personalDates";

describe("parseBirthday / parseCalendarDate", () => {
  it("acepta el 29 de febrero como cumpleaños y rechaza días que no existen", () => {
    expect(parseBirthday("02-29")).toEqual({ month: 2, day: 29 });
    expect(parseBirthday("02-30")).toBeNull();
    expect(parseBirthday("04-31")).toBeNull();
    expect(parseBirthday("13-01")).toBeNull();
    expect(parseBirthday("2-9")).toBeNull();
    expect(parseBirthday("")).toBeNull();
    expect(parseBirthday(undefined)).toBeNull();
  });

  it("el 29 de febrero con año solo vale en años bisiestos", () => {
    expect(parseCalendarDate("2020-02-29")).toEqual({ year: 2020, month: 2, day: 29 });
    expect(parseCalendarDate("2019-02-29")).toBeNull();
    expect(parseCalendarDate("1899-05-01")).toBeNull();
    expect(parseCalendarDate("2019-5-1")).toBeNull();
  });

  it("isLeapYear sigue la regla de los siglos", () => {
    expect([2024, 2000, 2026, 1900, 2100].map(isLeapYear)).toEqual([true, true, false, false, false]);
  });
});

describe("observedDay", () => {
  it("el 29 de febrero se celebra el 28 en años no bisiestos y el 29 en bisiestos", () => {
    expect(observedDay({ month: 2, day: 29 }, 2026)).toEqual({ month: 2, day: 28 });
    expect(observedDay({ month: 2, day: 29 }, 2028)).toEqual({ month: 2, day: 29 });
    expect(observedDay({ month: 3, day: 1 }, 2026)).toEqual({ month: 3, day: 1 });
  });
});

describe("occasionsOn", () => {
  it("sin fechas cargadas no hay nada: el inicio no cambia", () => {
    expect(occasionsOn(null, "2026-10-02")).toEqual([]);
    expect(occasionsOn(undefined, "2026-10-02")).toEqual([]);
    expect(occasionsOn({}, "2026-10-02")).toEqual([]);
  });

  it("saluda solo el día del cumpleaños", () => {
    const dates = { birthday: "10-02" };
    expect(occasionsOn(dates, "2026-10-02").map((o) => o.kind)).toEqual(["cumpleanos"]);
    expect(occasionsOn(dates, "2026-10-01")).toEqual([]);
    expect(occasionsOn(dates, "2026-10-03")).toEqual([]);
  });

  it("cumpleaños el 29 de febrero: se saluda el 28 en años no bisiestos, una sola vez", () => {
    const dates = { birthday: "02-29" };
    expect(occasionsOn(dates, "2027-02-28").map((o) => o.kind)).toEqual(["cumpleanos"]);
    expect(occasionsOn(dates, "2027-03-01")).toEqual([]);
    // En año bisiesto, el 29 y no el 28.
    expect(occasionsOn(dates, "2028-02-29").map((o) => o.kind)).toEqual(["cumpleanos"]);
    expect(occasionsOn(dates, "2028-02-28")).toEqual([]);
  });

  it("el 28 de febrero de verdad sigue siendo el 28, también en bisiestos", () => {
    expect(occasionsOn({ birthday: "02-28" }, "2028-02-28")).toHaveLength(1);
    expect(occasionsOn({ birthday: "02-28" }, "2028-02-29")).toEqual([]);
  });

  it("cuenta los años del bautismo o de la conversión", () => {
    expect(occasionsOn({ faithDate: "2023-10-02", faithDateKind: "bautismo" }, "2026-10-02")).toEqual([
      { kind: "bautismo", years: 3, verseRef: expect.any(String) },
    ]);
    expect(occasionsOn({ faithDate: "2025-10-02", faithDateKind: "conversion" }, "2026-10-02")).toEqual([
      { kind: "conversion", years: 1, verseRef: expect.any(String) },
    ]);
    // Sin tipo guardado se trata como bautismo.
    expect(occasionsOn({ faithDate: "2020-10-02" }, "2026-10-02")[0]?.kind).toBe("bautismo");
  });

  it("no hay aniversario el mismo año ni antes de la fecha", () => {
    expect(occasionsOn({ faithDate: "2026-10-02" }, "2026-10-02")).toEqual([]);
    expect(occasionsOn({ faithDate: "2027-10-02" }, "2026-10-02")).toEqual([]);
  });

  it("bautismo un 29 de febrero se recuerda el 28 en años no bisiestos", () => {
    expect(occasionsOn({ faithDate: "2020-02-29" }, "2023-02-28")).toEqual([
      { kind: "bautismo", years: 3, verseRef: expect.any(String) },
    ]);
  });

  it("cumpleaños y bautismo el mismo día: los dos, cumpleaños primero", () => {
    const occasions = occasionsOn({ birthday: "06-15", faithDate: "2010-06-15", faithDateKind: "bautismo" }, "2026-06-15");
    expect(occasions.map((o) => o.kind)).toEqual(["cumpleanos", "bautismo"]);
  });

  it("ignora fechas mal formadas en vez de romper", () => {
    expect(occasionsOn({ birthday: "xx", faithDate: "nope" }, "2026-10-02")).toEqual([]);
    expect(occasionsOn({ birthday: "10-02" }, "no-es-fecha")).toEqual([]);
  });

  it("el versículo cambia de un año al otro y siempre sale del catálogo curado", () => {
    const years = [2026, 2027, 2028, 2029, 2030, 2031];
    const birthdayRefs = years.map((year) => occasionsOn({ birthday: "05-10" }, `${year}-05-10`)[0]?.verseRef);
    expect(new Set(birthdayRefs).size).toBe(BIRTHDAY_VERSES.length);
    expect(birthdayRefs.every((ref) => (BIRTHDAY_VERSES as readonly string[]).includes(ref ?? ""))).toBe(true);
    const faithRefs = years.map((year) => occasionsOn({ faithDate: "2000-05-10" }, `${year}-05-10`)[0]?.verseRef);
    expect(new Set(faithRefs).size).toBe(FAITH_VERSES.length);
  });
});

describe("catálogo de versículos (regla dura #4)", () => {
  it("cada referencia es un versículo puntual de un libro del canon que el corpus puede resolver", () => {
    const invalid = [...BIRTHDAY_VERSES, ...FAITH_VERSES].filter((ref) => {
      const parsed = parseVerseRef(ref);
      const book = BIBLE_BOOKS.find((entry) => entry.name === parsed?.book);
      return !parsed || !book || parsed.chapter > book.chapters || ref.includes("-");
    });
    expect(invalid).toEqual([]);
  });
});

describe("localDateKey — la fecha local del teléfono", () => {
  // 2026-10-03 05:30 UTC: todavía es 2 de octubre en Honduras (UTC-6) y ya es 3 en Madrid.
  const instant = new Date("2026-10-03T05:30:00Z");

  it("usa la zona horaria que le toca, no UTC", () => {
    expect(localDateKey(instant, "America/Tegucigalpa")).toBe("2026-10-02");
    expect(localDateKey(instant, "Europe/Madrid")).toBe("2026-10-03");
    expect(localDateKey(instant, "UTC")).toBe("2026-10-03");
  });

  it("cambia de día justo a la medianoche local", () => {
    expect(localDateKey(new Date("2026-10-03T05:59:59Z"), "America/Tegucigalpa")).toBe("2026-10-02");
    expect(localDateKey(new Date("2026-10-03T06:00:00Z"), "America/Tegucigalpa")).toBe("2026-10-03");
  });

  it("el saludo aparece según el día local: a la misma hora, sí en Honduras y no en Madrid", () => {
    const dates = { birthday: "10-02" };
    expect(occasionsOn(dates, localDateKey(instant, "America/Tegucigalpa"))).toHaveLength(1);
    expect(occasionsOn(dates, localDateKey(instant, "Europe/Madrid"))).toEqual([]);
  });

  it("en un año no bisiesto, el saludo del 29 de febrero cae el 28 local aunque en UTC ya sea 1 de marzo", () => {
    const dates = { birthday: "02-29" };
    const lateFeb28InHonduras = new Date("2027-03-01T05:00:00Z");
    expect(localDateKey(lateFeb28InHonduras, "America/Tegucigalpa")).toBe("2027-02-28");
    expect(occasionsOn(dates, localDateKey(lateFeb28InHonduras, "America/Tegucigalpa"))).toHaveLength(1);
    expect(occasionsOn(dates, localDateKey(lateFeb28InHonduras, "UTC"))).toEqual([]);
  });

  it("sin zona horaria usa la del dispositivo", () => {
    expect(localDateKey(new Date(2026, 9, 2, 23, 59))).toBe("2026-10-02");
    expect(localDateKey(new Date(2026, 9, 3, 0, 0))).toBe("2026-10-03");
  });
});
