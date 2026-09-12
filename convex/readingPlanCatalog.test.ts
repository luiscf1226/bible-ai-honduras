import { describe, expect, it } from "vitest";

import { BIBLE_BOOKS, chaptersFor, indexOfBook } from "../src/lib/bibleBooks";
import { canonicalReadingPlan, findReadingPlan, readingsForDay } from "./readingPlanCatalog";

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

describe("findReadingPlan", () => {
  it("encuentra el plan canónico por id", () => {
    expect(findReadingPlan("canonico")).toBe(canonicalReadingPlan);
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
