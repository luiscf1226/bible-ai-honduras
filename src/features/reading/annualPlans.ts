/**
 * Ids de los planes de un año completo (no recorridos). Viven acá y no se
 * importan de `convex/readingPlanCatalog.ts` para no meter los JSON de todos
 * los planes en el bundle de la app; `annualPlans.test.ts` verifica que esta
 * lista coincida con `ANNUAL_READING_PLANS` del backend.
 */
export const CANONICAL_PLAN_ID = "canonico";
export const BEGINNER_PLAN_ID = "anual-para-empezar";

export const ANNUAL_PLAN_IDS: readonly string[] = [CANONICAL_PLAN_ID, BEGINNER_PLAN_ID];

/** Sin `planId` la pantalla del plan abre el canónico (compatibilidad con #114). */
export function isAnnualPlan(planId: string | undefined): boolean {
  return planId === undefined || ANNUAL_PLAN_IDS.includes(planId);
}

/** Overline de la tarjeta de inicio de un plan. */
export function planOverline(planId: string | undefined): string {
  if (planId === BEGINNER_PLAN_ID) return "PARA EMPEZAR";
  return isAnnualPlan(planId) ? "PLAN CANÓNICO" : "RECORRIDO";
}
