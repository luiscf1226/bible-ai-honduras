import { QUOTA_LIMITS, type QuotaModule } from "../../convex/quotas";

const DAILY_TAIL =
  "Vuelven a medianoche de Honduras, y el devocional del día sigue abierto para vos.";

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
  return "Ya usaste tu historia de muestra: incluye una generación por cuenta y no se renueva cada día. Podés seguir leyendo las historias en texto y abrir tu historia ilustrada.";
}

export function limitTitleFor(module: QuotaModule): string {
  return module === "stories" ? "Ya usaste tu historia de muestra" : "Por hoy llegaste al límite";
}
