/**
 * Repaso espaciado de "Memorizar" (#158). Lógica pura, sin funciones de
 * Convex: la comparten el backend (`convex/memorize.ts`), la app y los tests.
 *
 * Cuatro escalones: hoy, en 3 días, en 7 y en 21. El nivel es el índice del
 * escalón en el que está el versículo.
 *
 * - Agregar: nivel 0, primer repaso **mañana** (lo acabás de leer; el repaso
 *   del día siguiente es el primero que pone a prueba la memoria).
 * - Acertar: sube un escalón y se espacia (3 → 7 → 21). Arriba de todo se
 *   queda en 21 días: un versículo aprendido igual vuelve de vez en cuando.
 * - Fallar: vuelve al nivel 0 y queda para **hoy**, para intentarlo de nuevo.
 *
 * Las fechas son días del calendario de Honduras (YYYY-MM-DD), igual que el
 * devocional y el plan de lectura: "hoy" no depende de la zona del teléfono.
 */

/** Días hasta el próximo repaso según el nivel: hoy, 3, 7, 21. */
export const MEMORIZE_STEPS_DAYS = [0, 3, 7, 21] as const;

export const MEMORIZE_MAX_LEVEL = MEMORIZE_STEPS_DAYS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Fecha inválida: ${day}`);
  }
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDaysTo(day: string, days: number): string {
  return new Date(parseDay(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}

export type MemorizeState = { level: number; nextReview: string };

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.min(MEMORIZE_MAX_LEVEL, Math.max(0, Math.floor(level)));
}

/** Estado de un versículo recién agregado: nivel 0, repaso mañana. */
export function scheduleNew(today: string): MemorizeState {
  return { level: 0, nextReview: addDaysTo(today, 1) };
}

/** Estado después de un repaso: acertar espacia, fallar vuelve a hoy. */
export function scheduleAfterReview(state: { level: number }, correct: boolean, today: string): MemorizeState {
  if (!correct) {
    return { level: 0, nextReview: today };
  }
  const level = Math.min(MEMORIZE_MAX_LEVEL, clampLevel(state.level) + 1);
  return { level, nextReview: addDaysTo(today, MEMORIZE_STEPS_DAYS[level]) };
}

/** Toca repasarlo hoy: su fecha ya llegó (o se pasó porque no abrió la app). */
export function isDue(state: { nextReview: string }, today: string): boolean {
  return state.nextReview <= today;
}

/** "Hoy", "Mañana", "En 3 días"… para la lista de versículos. */
export function nextReviewLabel(nextReview: string, today: string): string {
  const days = daysBetween(today, nextReview);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}
