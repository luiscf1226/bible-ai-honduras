import ansiedadJson from "../docs/content/planes/ansiedad.json";
import canonicoJson from "../docs/content/planes/canonico.json";
import dueloJson from "../docs/content/planes/duelo.json";
import perdonJson from "../docs/content/planes/perdon.json";
import salmosParaDormirJson from "../docs/content/planes/salmos-para-dormir.json";
import semanaSantaJson from "../docs/content/planes/semana-santa.json";
import vidaDeJoseJson from "../docs/content/planes/vida-de-jose.json";

/**
 * Contenido curado de los planes de lectura, igual patrón que
 * `devotionalCatalog.ts`: JSON versionado en el repo, no generado por IA
 * (regla dura #4). Las fuentes viven en `docs/content/planes/`; este módulo
 * solo las carga, tipa y valida su forma antes de exportarlas.
 *
 * - `canonico.json`: el plan anual (#114).
 * - Un JSON por recorrido corto (#115): mismo formato, menos días. Un recorrido
 *   es un plan como cualquier otro — reusa el motor y las tablas del anual.
 *
 * La validación profunda contra el canon (cantidad de capítulos por libro,
 * rangos de versículos, cobertura completa del canónico) vive en
 * `readingPlanCatalog.test.ts`, que cruza este módulo con
 * `src/lib/bibleBooks.ts`. Ese cruce es un test, no código de producción: el
 * backend de Convex no importa nada de `src/` a propósito (mismo criterio que
 * el resto de `convex/`).
 */

export type ReadingPlanReading = {
  book: string;
  chapter: number;
  /**
   * Pasaje dentro del capítulo (#115): un recorrido temático necesita
   * "Mateo 6:25-34", no el capítulo entero. Sin estos campos la lectura es el
   * capítulo completo (así es todo el plan canónico). El lector abre en
   * `verseStart`.
   */
  verseStart?: number;
  verseEnd?: number;
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
      assertValidVerseRange(candidate.id ?? "", entry.day, reading);
    }
  });
}

function assertValidVerseRange(planId: string, day: number, reading: ReadingPlanReading) {
  const { verseStart, verseEnd } = reading;
  if (verseStart === undefined && verseEnd === undefined) {
    return;
  }
  const label = `${reading.book} ${reading.chapter}`;
  if (verseStart === undefined || verseEnd === undefined) {
    throw new Error(`El día ${day} del plan ${planId} tiene un pasaje incompleto en ${label}: van verseStart y verseEnd juntos`);
  }
  if (!Number.isInteger(verseStart) || verseStart < 1 || !Number.isInteger(verseEnd) || verseEnd < verseStart) {
    throw new Error(`El día ${day} del plan ${planId} tiene un rango de versículos inválido en ${label}`);
  }
}

function loadPlan(json: unknown): ReadingPlanDefinition {
  assertValidPlan(json);
  return json;
}

/** El plan anual (#114). */
export const canonicalReadingPlan: ReadingPlanDefinition = loadPlan(canonicoJson);

/**
 * Recorridos cortos (#115), en el orden en que se muestran en el catálogo.
 * Pendientes de revisión pastoral antes del lanzamiento — ver
 * `docs/content/planes/README.md`.
 */
export const JOURNEY_READING_PLANS: readonly ReadingPlanDefinition[] = [
  loadPlan(ansiedadJson),
  loadPlan(perdonJson),
  loadPlan(dueloJson),
  loadPlan(salmosParaDormirJson),
  loadPlan(vidaDeJoseJson),
  loadPlan(semanaSantaJson),
];

export const SUPPORTED_READING_PLANS: readonly ReadingPlanDefinition[] = [canonicalReadingPlan, ...JOURNEY_READING_PLANS];

export function findReadingPlan(planId: string): ReadingPlanDefinition | null {
  return SUPPORTED_READING_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function readingsForDay(plan: ReadingPlanDefinition, day: number): ReadingPlanReading[] {
  return plan.days.find((entry) => entry.day === day)?.readings ?? [];
}
