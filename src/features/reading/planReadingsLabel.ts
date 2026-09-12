export type PlanReading = { book: string; chapter: number };

/**
 * Formatea las lecturas de un día del plan como texto legible, comprimiendo
 * capítulos consecutivos del mismo libro en un rango ("Génesis 1-3") en vez de
 * listarlos uno por uno. Puro y sin react-native (mismo criterio que
 * `chapterNavigation.ts`): el runtime de vitest es edge-runtime y no resuelve
 * RN/expo-router.
 */
export function formatReadingsLabel(readings: readonly PlanReading[]): string {
  const groups: { book: string; from: number; to: number }[] = [];

  for (const reading of readings) {
    const last = groups[groups.length - 1];
    if (last && last.book === reading.book && reading.chapter === last.to + 1) {
      last.to = reading.chapter;
    } else {
      groups.push({ book: reading.book, from: reading.chapter, to: reading.chapter });
    }
  }

  return groups
    .map((group) => (group.from === group.to ? `${group.book} ${group.from}` : `${group.book} ${group.from}-${group.to}`))
    .join(", ");
}
