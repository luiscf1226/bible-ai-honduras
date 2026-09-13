import { describe, expect, it } from "vitest";

import { findReadingPlan, JOURNEY_READING_PLANS } from "../../../convex/readingPlanCatalog";
import { FEELINGS } from "../feelings/feelings";
import { FEELING_JOURNEYS, JOURNEY_TOPICS, journeyCtaLabel, journeyForFeelings } from "./feelingJourneys";

describe("FEELING_JOURNEYS", () => {
  it("solo mapea sentimientos que existen en Sentir", () => {
    for (const feeling of Object.keys(FEELING_JOURNEYS)) {
      expect(FEELINGS).toContain(feeling);
    }
  });

  it("cada sentimiento mapeado apunta a un recorrido del catálogo, nunca al plan anual", () => {
    const journeyIds = JOURNEY_READING_PLANS.map((plan) => plan.id);
    for (const planId of Object.values(FEELING_JOURNEYS)) {
      expect(journeyIds).toContain(planId);
      expect(findReadingPlan(planId ?? "")).not.toBeNull();
    }
  });

  it("cada recorrido mapeado tiene cómo nombrarse en la frase del CTA", () => {
    for (const planId of Object.values(FEELING_JOURNEYS)) {
      expect(JOURNEY_TOPICS[planId ?? ""]).toBeTruthy();
    }
  });

  it("mapea los temas del issue", () => {
    expect(FEELING_JOURNEYS.Ansiedad).toBe("ansiedad");
    expect(FEELING_JOURNEYS.Duelo).toBe("duelo");
    expect(FEELING_JOURNEYS["Necesito perdonar"]).toBe("perdon");
  });

  it("no fuerza un recorrido para sentimientos sin uno pertinente", () => {
    expect(FEELING_JOURNEYS.Deudas).toBeUndefined();
    expect(FEELING_JOURNEYS["Sin trabajo"]).toBeUndefined();
    expect(FEELING_JOURNEYS.Gratitud).toBeUndefined();
  });
});

describe("journeyForFeelings", () => {
  it("devuelve el recorrido del sentimiento elegido", () => {
    expect(journeyForFeelings(["Ansiedad"])).toEqual({ feeling: "Ansiedad", planId: "ansiedad", topic: "la ansiedad" });
  });

  it("con varios sentimientos, gana el primero elegido que tenga recorrido", () => {
    expect(journeyForFeelings(["Deudas", "Duelo", "Ansiedad"])?.planId).toBe("duelo");
  });

  it("null si ningún sentimiento elegido tiene recorrido", () => {
    expect(journeyForFeelings(["Deudas", "Sin trabajo"])).toBeNull();
  });

  it("null sin sentimientos elegidos (solo texto libre, o un devocional abierto del historial)", () => {
    expect(journeyForFeelings([])).toBeNull();
  });

  it("ignora texto que no es un sentimiento de la lista", () => {
    expect(journeyForFeelings(["ansiedad", "toString"])).toBeNull();
  });
});

describe("journeyCtaLabel", () => {
  it("arma la frase con la duración del recorrido y el tema", () => {
    expect(journeyCtaLabel(7, "la ansiedad")).toBe("Seguí con el recorrido de 7 días sobre la ansiedad");
  });
});
