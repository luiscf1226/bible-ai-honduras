import canonicoJson from "../docs/content/planes/canonico.json";

/**
 * Contenido curado del plan de lectura anual (#114), igual patrón que
 * `devotionalCatalog.ts`: JSON versionado en el repo, no generado por IA
 * (regla dura #4). La fuente vive en `docs/content/planes/canonico.json`;
 * este módulo solo la carga, tipa y valida su forma antes de exportarla.
 *
 * La validación profunda contra el canon (cantidad de capítulos por libro,
 * cobertura completa de Génesis 1 a Apocalipsis 22) vive en
 * `readingPlanCatalog.test.ts`, que cruza este módulo con
 * `src/lib/bibleBooks.ts`. Ese cruce es un test, no código de producción: el
 * backend de Convex no importa nada de `src/` a propósito (mismo criterio que
 * el resto de `convex/`).
 */

export type ReadingPlanReading = {
  book: string;
  chapter: number;
};

export type ReadingPlanDay = {
  day: number;
  readings: ReadingPlanReading[];
};

export type ReadingPlanDefinition = {
  id: string;
  name: string;
  description: string;
  totalDays: number;
  days: ReadingPlanDay[];
};

function assertValidPlan(plan: unknown): asserts plan is ReadingPlanDefinition {
  if (typeof plan !== "object" || plan === null) {
    throw new Error("El plan de lectura debe ser un objeto");
  }
  const candidate = plan as Partial<ReadingPlanDefinition>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    throw new Error("El plan de lectura necesita un id");
  }
  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    throw new Error(`El plan ${candidate.id} necesita un nombre`);
  }
  if (typeof candidate.description !== "string" || candidate.description.length === 0) {
    throw new Error(`El plan ${candidate.id} necesita una descripción`);
  }
  if (!Array.isArray(candidate.days) || candidate.days.length === 0) {
    throw new Error(`El plan ${candidate.id} necesita al menos un día`);
  }
  if (candidate.totalDays !== candidate.days.length) {
    throw new Error(
      `El plan ${candidate.id} declara totalDays=${candidate.totalDays} pero tiene ${candidate.days.length} días`,
    );
  }

  candidate.days.forEach((entry, index) => {
    const expectedDay = index + 1;
    if (entry.day !== expectedDay) {
      throw new Error(`El plan ${candidate.id} tiene los días desordenados: se esperaba ${expectedDay}, vino ${entry.day}`);
    }
    if (!Array.isArray(entry.readings) || entry.readings.length === 0) {
      throw new Error(`El día ${entry.day} del plan ${candidate.id} no tiene lecturas`);
    }
    for (const reading of entry.readings) {
      if (typeof reading.book !== "string" || reading.book.length === 0) {
        throw new Error(`El día ${entry.day} del plan ${candidate.id} tiene una lectura sin libro`);
      }
      if (!Number.isInteger(reading.chapter) || reading.chapter < 1) {
        throw new Error(`El día ${entry.day} del plan ${candidate.id} tiene un capítulo inválido en ${reading.book}`);
      }
    }
  });
}

const rawCanonico = canonicoJson as ReadingPlanDefinition;
assertValidPlan(rawCanonico);

/** El único plan soportado en esta primera versión — regla dura de producto, no técnica. */
export const canonicalReadingPlan: ReadingPlanDefinition = rawCanonico;

export const SUPPORTED_READING_PLANS: readonly ReadingPlanDefinition[] = [canonicalReadingPlan];

export function findReadingPlan(planId: string): ReadingPlanDefinition | null {
  return SUPPORTED_READING_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function readingsForDay(plan: ReadingPlanDefinition, day: number): ReadingPlanReading[] {
  return plan.days.find((entry) => entry.day === day)?.readings ?? [];
}
