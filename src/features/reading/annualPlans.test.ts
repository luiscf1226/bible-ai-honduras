import { describe, expect, it } from "vitest";

import { ANNUAL_READING_PLANS } from "../../../convex/readingPlanCatalog";
import { ANNUAL_PLAN_IDS, BEGINNER_PLAN_ID, isAnnualPlan, planOverline } from "./annualPlans";

describe("annualPlans", () => {
  it("coincide con los planes anuales del backend", () => {
    expect(ANNUAL_PLAN_IDS).toEqual(ANNUAL_READING_PLANS.map((plan) => plan.id));
  });

  it("distingue planes anuales de recorridos", () => {
    expect(isAnnualPlan(undefined)).toBe(true);
    expect(isAnnualPlan("canonico")).toBe(true);
    expect(isAnnualPlan(BEGINNER_PLAN_ID)).toBe(true);
    expect(isAnnualPlan("ansiedad")).toBe(false);
  });

  it("rotula cada plan", () => {
    expect(planOverline(undefined)).toBe("PLAN CANÓNICO");
    expect(planOverline(BEGINNER_PLAN_ID)).toBe("PARA EMPEZAR");
    expect(planOverline("ansiedad")).toBe("RECORRIDO");
  });
});
