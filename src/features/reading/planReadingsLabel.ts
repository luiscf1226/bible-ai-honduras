import type { PassageQuery } from "./bookSearch";

/**
 * Una lectura de un plan. Sin `verseStart`/`verseEnd` es el capítulo completo
 * (plan anual); con ellos, un pasaje dentro del capítulo (recorridos, #115).
 */
export type PlanReading = { book: string; chapter: number; verseStart?: number; verseEnd?: number };

function isPassage(reading: PlanReading): reading is PlanReading & { verseStart: number } {
  return reading.verseStart !== undefined;
}

function passageLabel(reading: PlanReading & { verseStart: number }): string {
  const end = reading.verseEnd ?? reading.verseStart;
  const verses = end === reading.verseStart ? `${reading.verseStart}` : `${reading.verseStart}-${end}`;
  return `${reading.book} ${reading.chapter}:${verses}`;
}

/**
 * Formatea las lecturas de un día del plan como texto legible, comprimiendo
 * capítulos consecutivos del mismo libro en un rango ("Génesis 1-3") en vez de
 * listarlos uno por uno. Un pasaje se muestra con sus versículos
 * ("Mateo 6:25-34") y nunca se comprime con capítulos vecinos. Puro y sin
 * react-native (mismo criterio que `chapterNavigation.ts`): el runtime de
 * vitest es edge-runtime y no resuelve RN/expo-router.
 */
export function formatReadingsLabel(readings: readonly PlanReading[]): string {
  const groups: ({ kind: "chapters"; book: string; from: number; to: number } | { kind: "passage"; label: string })[] = [];

  for (const reading of readings) {
    if (isPassage(reading)) {
      groups.push({ kind: "passage", label: passageLabel(reading) });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.kind === "chapters" && last.book === reading.book && reading.chapter === last.to + 1) {
      last.to = reading.chapter;
    } else {
      groups.push({ kind: "chapters", book: reading.book, from: reading.chapter, to: reading.chapter });
    }
  }

  return groups
    .map((group) => {
      if (group.kind === "passage") return group.label;
      return group.from === group.to ? `${group.book} ${group.from}` : `${group.book} ${group.from}-${group.to}`;
    })
    .join(", ");
}

/** Adónde abre el lector una lectura del plan: el capítulo, en `verseStart` si es un pasaje. */
export function readingTarget(reading: PlanReading): PassageQuery {
  return isPassage(reading)
    ? { book: reading.book, chapter: reading.chapter, verse: reading.verseStart }
    : { book: reading.book, chapter: reading.chapter };
}
