import type { Feeling } from "../feelings/feelings";

/**
 * Puente Sentir → recorridos de lectura (#115). Puro, sin react-native.
 *
 * No todos los sentimientos tienen recorrido: solo los que tienen uno curado
 * directamente pertinente en `docs/content/planes/`. Los que no están acá no
 * muestran nada al final del devocional — mejor ningún CTA que uno forzado.
 */
export const FEELING_JOURNEYS: Partial<Record<Feeling, string>> = {
  Ansiedad: "ansiedad",
  Miedo: "ansiedad",
  Duelo: "duelo",
  "Necesito perdonar": "perdon",
  Cansancio: "salmos-para-dormir",
};

/** Cómo se nombra el tema de cada recorrido dentro de una frase ("sobre la ansiedad"). */
export const JOURNEY_TOPICS: Record<string, string> = {
  ansiedad: "la ansiedad",
  duelo: "el duelo",
  perdon: "el perdón",
  "salmos-para-dormir": "el descanso",
};

export type FeelingJourney = { feeling: Feeling; planId: string; topic: string };

/**
 * El recorrido que corresponde a los sentimientos elegidos: el del primero (en
 * el orden en que la persona los eligió) que tenga uno. null si ninguno tiene.
 */
export function journeyForFeelings(selected: readonly string[]): FeelingJourney | null {
  for (const feeling of selected) {
    if (!Object.hasOwn(FEELING_JOURNEYS, feeling)) continue;
    const planId = FEELING_JOURNEYS[feeling as Feeling];
    const topic = planId && Object.hasOwn(JOURNEY_TOPICS, planId) ? JOURNEY_TOPICS[planId] : undefined;
    if (planId && topic) {
      return { feeling: feeling as Feeling, planId, topic };
    }
  }
  return null;
}

export function journeyCtaLabel(totalDays: number, topic: string): string {
  return `Seguí con el recorrido de ${totalDays} días sobre ${topic}`;
}
