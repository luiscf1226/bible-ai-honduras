import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS } from "../src/lib/bibleBooks";
import { parseVerseRef } from "../src/lib/parseVerseRef";
import { devotionalCatalog, devotionalForMonthDay } from "./devotionalCatalog";
import { DAYS_IN_MONTH, devotionalMonths } from "./devotionals";

// Largos en caracteres. Pensados para que `/hoy` (#194) entre en pantalla sin
// muros de texto: oración inicial de 1–2 oraciones, introducción de 2–3,
// reflexión de 2–4 y oración final de 2–3.
const LIMITS = {
  openingPrayer: { min: 20, max: 200 },
  intro: { min: 80, max: 360 },
  reflection: { min: 80, max: 400 },
  closingPrayer: { min: 50, max: 300 },
} as const;

const TEXT_FIELDS = Object.keys(LIMITS) as (keyof typeof LIMITS)[];

// Heurística simple de la regla dura #2: Jesús, Dios y el Espíritu Santo nunca
// hablan en 1ra persona en el contenido editorial.
const DIVINE_FIRST_PERSON = [
  /\byo soy\b/i,
  /\bdice (el señor|jehová|dios|jesús)\s*:/i,
  /\b(hijo|hija) mí[oa]\b/i,
  /\bmi (hijo|hija) amad[oa]\b/i,
  /\byo te (amo|perdono|sostengo|guardo|daré|doy)\b/i,
];

// El texto bíblico se resuelve por `verseRef`; el catálogo no cita (#93).
const QUOTE_MARKS = /["“”«»]/;

const VERSE_REF_FORMAT = /^(.+) (\d+):(\d+)(?:-(\d+))?$/;

function allDatesOfLeapYear(): string[] {
  const dates: string[] = [];
  for (let time = Date.UTC(2028, 0, 1); time < Date.UTC(2029, 0, 1); time += 24 * 60 * 60 * 1000) {
    dates.push(new Date(time).toISOString().slice(5, 10));
  }
  return dates;
}

describe("devotionalCatalog: un devocional por día del calendario", () => {
  it("tiene 366 entradas, una por cada mes-día, incluido el 29 de febrero", () => {
    expect(devotionalCatalog).toHaveLength(366);
    expect(devotionalCatalog.map((item) => item.catalogId)).toEqual(allDatesOfLeapYear());
    expect(devotionalForMonthDay(2, 29).catalogId).toBe("02-29");
    expect(devotionalForMonthDay(12, 31).catalogId).toBe("12-31");
  });

  it("cada mes trae sus días en orden y completos", () => {
    expect(devotionalMonths).toHaveLength(12);
    devotionalMonths.forEach((entries, monthIndex) => {
      expect(entries).toHaveLength(DAYS_IN_MONTH[monthIndex]);
      expect(entries.map((entry) => entry.day)).toEqual(entries.map((_, index) => index + 1));
    });
  });

  it("rechaza días que no existen en el calendario", () => {
    expect(() => devotionalForMonthDay(2, 30)).toThrow();
    expect(() => devotionalForMonthDay(13, 1)).toThrow();
  });

  it.each(TEXT_FIELDS)("%s: presente y dentro de los largos de /hoy en los 366 días", (field) => {
    const { min, max } = LIMITS[field];
    const outOfRange = devotionalCatalog
      .filter((item) => item[field].trim().length < min || item[field].length > max)
      .map((item) => `${item.catalogId} (${item[field].length})`);
    expect(outOfRange).toEqual([]);
  });

  it("la oración final cierra con Amén.", () => {
    expect(devotionalCatalog.filter((item) => !item.closingPrayer.endsWith("Amén.")).map((item) => item.catalogId)).toEqual([]);
  });

  it("trae imagen con texto alternativo y atribución en cada día", () => {
    expect(devotionalCatalog.every((item) => item.imageUrl && item.imageAlt && item.imageAttributionUrl)).toBe(true);
  });

  it("no repite un pasaje en el año", () => {
    const refs = devotionalCatalog.map((item) => item.verseRef);
    const repeated = refs.filter((ref, index) => refs.indexOf(ref) !== index);
    expect(repeated).toEqual([]);
  });

  it("cada pasaje se puede resolver contra el corpus: libro del canon, capítulo existente, rango en un capítulo", () => {
    const invalid = devotionalCatalog.filter((item) => {
      const parsed = parseVerseRef(item.verseRef);
      const format = item.verseRef.match(VERSE_REF_FORMAT);
      const book = BIBLE_BOOKS.find((entry) => entry.name === parsed?.book);
      if (!parsed || !format || !book) return true;
      const end = format[4] ? Number(format[4]) : parsed.verse;
      return parsed.chapter < 1 || parsed.chapter > book.chapters || parsed.verse < 1 || end < parsed.verse || end - parsed.verse > 4;
    });
    expect(invalid.map((item) => `${item.catalogId}: ${item.verseRef}`)).toEqual([]);
  });

  it("recorre ambos Testamentos", () => {
    const testaments = new Set(
      devotionalCatalog.map((item) => BIBLE_BOOKS.find((book) => book.name === parseVerseRef(item.verseRef)?.book)?.testament),
    );
    expect(testaments).toEqual(new Set(["antiguo", "nuevo"]));
  });

  it("no pone a Jesús, Dios ni el Espíritu Santo a hablar en 1ra persona (regla dura #2)", () => {
    const offending = devotionalCatalog.flatMap((item) =>
      TEXT_FIELDS.filter((field) => DIVINE_FIRST_PERSON.some((pattern) => pattern.test(item[field]))).map(
        (field) => `${item.catalogId}.${field}`,
      ),
    );
    expect(offending).toEqual([]);
  });

  it("no cita texto bíblico entre comillas: el pasaje sale del corpus", () => {
    const quoted = devotionalCatalog.flatMap((item) =>
      TEXT_FIELDS.filter((field) => QUOTE_MARKS.test(item[field])).map((field) => `${item.catalogId}.${field}`),
    );
    expect(quoted).toEqual([]);
  });

  it("la heurística de 1ra persona divina atrapa los casos obvios", () => {
    expect(DIVINE_FIRST_PERSON.some((pattern) => pattern.test("Yo soy el Señor tu Dios"))).toBe(true);
    expect(DIVINE_FIRST_PERSON.some((pattern) => pattern.test("Así dice el Señor: yo te sostengo"))).toBe(true);
    expect(DIVINE_FIRST_PERSON.some((pattern) => pattern.test("Hija mía, no temás"))).toBe(true);
    expect(DIVINE_FIRST_PERSON.some((pattern) => pattern.test("Jesús dijo que él es el camino"))).toBe(false);
  });
});
