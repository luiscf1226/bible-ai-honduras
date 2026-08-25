import { QUOTA_LIMITS, type QuotaModule } from "../../convex/quotas";

const DAILY_TAIL =
  "Vuelven mañana a las 6:00 a.m., y el devocional del día sigue abierto para ti.";

export function limitBodyFor(module: QuotaModule): string {
  if (module === "qa") {
    return `Usaste tus ${QUOTA_LIMITS.qa} preguntas gratis de hoy. ${DAILY_TAIL}`;
  }
  if (module === "voices") {
    return `Usaste tus ${QUOTA_LIMITS.voices} conversaciones gratis de hoy. ${DAILY_TAIL}`;
  }
  if (module === "feelings") {
    return `Usaste tus ${QUOTA_LIMITS.feelings} devocionales gratis de hoy. ${DAILY_TAIL}`;
  }
  return "Ya usaste tu historia de muestra. Con Pro puedes ilustrar todas. El devocional del día sigue abierto para ti.";
}
