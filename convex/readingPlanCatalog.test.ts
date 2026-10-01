import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS, chaptersFor, indexOfBook } from "../src/lib/bibleBooks";
import {
  ANNUAL_READING_PLANS,
  beginnerReadingPlan,
  canonicalReadingPlan,
  findReadingPlan,
  JOURNEY_READING_PLANS,
  readingsForDay,
  SUPPORTED_READING_PLANS,
  type ReadingPlanReading,
} from "./readingPlanCatalog";

// Este archivo es un test, no código de producción: cruza el módulo de Convex
// con `src/lib/bibleBooks.ts` para verificar que el JSON versionado
// (docs/content/planes/canonico.json) es en verdad el canon completo. El
// módulo de Convex en sí NO importa nada de `src/` (ver el comentario en
// readingPlanCatalog.ts).
describe("canonicalReadingPlan", () => {
  it("dura 365 días", () => {
    expect(canonicalReadingPlan.totalDays).toBe(365);
    expect(canonicalReadingPlan.days).toHaveLength(365);
  });

  it("empieza en Génesis 1 y termina en Apocalipsis 22", () => {
    expect(canonicalReadingPlan.days[0].readings[0]).toEqual({ book: "Génesis", chapter: 1 });
    const lastDay = canonicalReadingPlan.days[canonicalReadingPlan.days.length - 1];
    expect(lastDay.readings[lastDay.readings.length - 1]).toEqual({ book: "Apocalipsis", chapter: 22 });
  });

  it("cubre cada capítulo del canon exactamente una vez, en orden canónico", () => {
    const flattened = canonicalReadingPlan.days.flatMap((day) => day.readings);

    const expected: { book: string; chapter: number }[] = [];
    for (const book of BIBLE_BOOKS) {
      for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
        expected.push({ book: book.name, chapter });
      }
    }

    expect(flattened).toEqual(expected);
  });

  it("todos los libros que menciona existen en el canon y ningún capítulo se pasa del total del libro", () => {
    for (const day of canonicalReadingPlan.days) {
      for (const reading of day.readings) {
        expect(indexOfBook(reading.book)).toBeGreaterThanOrEqual(0);
        expect(reading.chapter).toBeGreaterThanOrEqual(1);
        expect(reading.chapter).toBeLessThanOrEqual(chaptersFor(reading.book));
      }
    }
  });

  it("los días están numerados 1..365 sin huecos ni duplicados", () => {
    expect(canonicalReadingPlan.days.map((day) => day.day)).toEqual(
      Array.from({ length: 365 }, (_, index) => index + 1),
    );
  });

  it("reparte los capítulos lo más parejo posible (3 o 4 por día)", () => {
    const counts = new Set(canonicalReadingPlan.days.map((day) => day.readings.length));
    expect([...counts].every((count) => count === 3 || count === 4)).toBe(true);
  });
});

describe("beginnerReadingPlan — la Biblia en un año para empezar", () => {
  const key = (reading: { book: string; chapter: number }) => `${reading.book} ${reading.chapter}`;

  it("dura 365 días numerados 1..365 sin huecos", () => {
    expect(beginnerReadingPlan.totalDays).toBe(365);
    expect(beginnerReadingPlan.days.map((day) => day.day)).toEqual(Array.from({ length: 365 }, (_, index) => index + 1));
  });

  it("cubre cada capítulo del canon exactamente una vez", () => {
    const flattened = beginnerReadingPlan.days.flatMap((day) => day.readings).map(key);
    const expected = BIBLE_BOOKS.flatMap((book) =>
      Array.from({ length: book.chapters }, (_, index) => key({ book: book.name, chapter: index + 1 })),
    );
    expect(flattened).toHaveLength(expected.length);
    expect([...flattened].sort()).toEqual([...expected].sort());
  });

  it("el día 1 arranca con las tres partes: Génesis 1, Mateo 1 y Salmos 1", () => {
    expect(beginnerReadingPlan.days[0].readings.map(key)).toEqual(expect.arrayContaining(["Génesis 1", "Mateo 1", "Salmos 1"]));
  });

  it("las tres partes terminan en la última semana del año", () => {
    const dayOf = (reference: string) =>
      beginnerReadingPlan.days.find((day) => day.readings.some((reading) => key(reading) === reference))?.day ?? 0;
    expect(dayOf("Malaquías 4")).toBe(365);
    expect(dayOf("Apocalipsis 22")).toBeGreaterThanOrEqual(359);
    expect(dayOf("Proverbios 31")).toBeGreaterThanOrEqual(359);
  });

  it("cada día trae Antiguo Testamento y una carga liviana (2 a 5 capítulos)", () => {
    for (const day of beginnerReadingPlan.days) {
      expect(day.readings.length).toBeGreaterThanOrEqual(2);
      expect(day.readings.length).toBeLessThanOrEqual(5);
      expect(day.readings.some((reading) => BIBLE_BOOKS[indexOfBook(reading.book)].testament === "antiguo")).toBe(true);
    }
  });

  it("cada parte avanza en orden: ningún capítulo se lee antes que el anterior de su libro", () => {
    const seen = new Map<string, number>();
    for (const reading of beginnerReadingPlan.days.flatMap((day) => day.readings)) {
      expect(reading.chapter).toBe((seen.get(reading.book) ?? 0) + 1);
      seen.set(reading.book, reading.chapter);
    }
  });

  it("solo trae nombre, descripción y referencias a capítulos completos (regla dura #4)", () => {
    expect(Object.keys(beginnerReadingPlan).sort()).toEqual(["days", "description", "id", "name", "totalDays"]);
    for (const reading of beginnerReadingPlan.days.flatMap((day) => day.readings)) {
      expect(Object.keys(reading).sort()).toEqual(["book", "chapter"]);
    }
  });

  it("es uno de los planes anuales y se encuentra por id", () => {
    expect(ANNUAL_READING_PLANS).toEqual([canonicalReadingPlan, beginnerReadingPlan]);
    expect(findReadingPlan("anual-para-empezar")).toBe(beginnerReadingPlan);
  });
});

describe("findReadingPlan", () => {
  it("encuentra el plan canónico por id", () => {
    expect(findReadingPlan("canonico")).toBe(canonicalReadingPlan);
  });

  it("encuentra un recorrido por id", () => {
    expect(findReadingPlan("ansiedad")?.name).toBe("Ansiedad");
  });

  it("devuelve null para un plan que no existe (cronológico, M'Cheyne, etc. no están en v1)", () => {
    expect(findReadingPlan("cronologico")).toBeNull();
  });
});

describe("readingsForDay", () => {
  it("devuelve las lecturas del día pedido", () => {
    expect(readingsForDay(canonicalReadingPlan, 1)).toEqual([
      { book: "Génesis", chapter: 1 },
      { book: "Génesis", chapter: 2 },
      { book: "Génesis", chapter: 3 },
    ]);
  });

  it("devuelve un arreglo vacío para un día fuera de rango", () => {
    expect(readingsForDay(canonicalReadingPlan, 0)).toEqual([]);
    expect(readingsForDay(canonicalReadingPlan, 366)).toEqual([]);
  });
});

// Cantidad de versículos de cada capítulo que un recorrido cita por pasaje
// (versificación RV1909). No hay una tabla de versículos del canon en el repo
// — `bibleBooks.ts` solo trae capítulos —, así que se lista acá solo lo que
// usan los recorridos. El test de abajo exige que todo capítulo citado con
// `verseStart`/`verseEnd` esté en esta tabla: agregar un pasaje nuevo obliga a
// anotar su capítulo, y un typo como "Mateo 6:25-43" no pasa.
const VERSES_IN_CHAPTER: Record<string, number> = {
  "Mateo 6": 34,
  "Mateo 18": 35,
  "Mateo 21": 46,
  "Mateo 26": 75,
  "Mateo 27": 66,
  "Lucas 15": 32,
  "Juan 11": 57,
  "Juan 13": 38,
  "Juan 14": 31,
  "1 Corintios 15": 58,
  "2 Corintios 1": 24,
  "Efesios 4": 32,
  "Filipenses 4": 23,
  "Colosenses 3": 25,
  "1 Tesalonicenses 4": 18,
  "1 Pedro 5": 14,
  "1 Juan 1": 10,
  "Apocalipsis 21": 27,
  "Isaías 41": 29,
  "Lamentaciones 3": 66,
};

describe("recorridos (#115)", () => {
  it("hay al menos 6 recorridos curados", () => {
    expect(JOURNEY_READING_PLANS.length).toBeGreaterThanOrEqual(6);
  });

  it("incluye los recorridos pedidos en el issue", () => {
    const ids = JOURNEY_READING_PLANS.map((plan) => plan.id);
    for (const id of ["ansiedad", "perdon", "salmos-para-dormir", "vida-de-jose", "semana-santa", "duelo"]) {
      expect(ids).toContain(id);
    }
  });

  it("los ids de todos los planes son únicos", () => {
    const ids = SUPPORTED_READING_PLANS.map((plan) => plan.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el plan canónico no usa pasajes: sus lecturas son capítulos completos", () => {
    const withVerses = canonicalReadingPlan.days.flatMap((day) => day.readings).filter((reading) => reading.verseStart !== undefined);
    expect(withVerses).toEqual([]);
  });

  describe.each(JOURNEY_READING_PLANS.map((plan) => [plan.id, plan] as const))("%s", (_id, plan) => {
    const readings: ReadingPlanReading[] = plan.days.flatMap((day) => day.readings);

    it("dura entre 7 y 30 días, numerados 1..N sin huecos", () => {
      expect(plan.totalDays).toBeGreaterThanOrEqual(7);
      expect(plan.totalDays).toBeLessThanOrEqual(30);
      expect(plan.days.map((day) => day.day)).toEqual(Array.from({ length: plan.totalDays }, (_, index) => index + 1));
    });

    it("solo trae nombre, descripción de una línea y referencias — ningún texto devocional (regla dura #4)", () => {
      expect(Object.keys(plan).sort()).toEqual(["days", "description", "id", "name", "totalDays"]);
      expect(plan.description).not.toContain("\n");
      for (const day of plan.days) {
        expect(Object.keys(day).sort()).toEqual(["day", "readings"]);
        for (const reading of day.readings) {
          for (const key of Object.keys(reading)) {
            expect(["book", "chapter", "verseStart", "verseEnd"]).toContain(key);
          }
        }
      }
    });

    it("cada referencia existe en el canon: libro, capítulo dentro de rango y versículos coherentes", () => {
      for (const reading of readings) {
        const label = `${reading.book} ${reading.chapter}`;
        expect(indexOfBook(reading.book), `libro desconocido: ${reading.book}`).toBeGreaterThanOrEqual(0);
        expect(reading.chapter).toBeGreaterThanOrEqual(1);
        expect(reading.chapter, `${label} se pasa del libro`).toBeLessThanOrEqual(chaptersFor(reading.book));

        if (reading.verseStart === undefined && reading.verseEnd === undefined) {
          continue;
        }
        expect(reading.verseStart, `${label}: falta verseStart`).toBeDefined();
        expect(reading.verseEnd, `${label}: falta verseEnd`).toBeDefined();
        const verseStart = reading.verseStart ?? 0;
        const verseEnd = reading.verseEnd ?? 0;
        expect(verseStart).toBeGreaterThanOrEqual(1);
        expect(verseStart, `${label}: verseStart > verseEnd`).toBeLessThanOrEqual(verseEnd);
        const versesInChapter = VERSES_IN_CHAPTER[label];
        expect(versesInChapter, `${label} no está en VERSES_IN_CHAPTER`).toBeDefined();
        expect(verseEnd, `${label}:${verseEnd} no existe`).toBeLessThanOrEqual(versesInChapter ?? 0);
      }
    });
  });
});
