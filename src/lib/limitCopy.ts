import { QUOTA_LIMITS, type QuotaModule } from "../../convex/quotaLimits";

const DAILY_TAIL =
  "Vuelven a medianoche de Honduras, y el devocional del día sigue abierto para vos.";

export function limitBodyFor(module: QuotaModule): string {
  if (module === "qa") {
    return `Usaste tus ${QUOTA_LIMITS.qa} preguntas gratis de hoy. ${DAILY_TAIL}`;
  }
  if (module === "voices") {
    return `Usaste tus ${QUOTA_LIMITS.voices} mensajes gratis de hoy. ${DAILY_TAIL}`;
  }
  if (module === "feelings") {
    return `Usaste tus ${QUOTA_LIMITS.feelings} devocionales gratis de hoy. ${DAILY_TAIL}`;
  }
  if (module === "verseImage") {
    return `Ya hiciste tus ${QUOTA_LIMITS.verseImage} fondos con IA de hoy. Mañana podés hacer más; mientras, elegí una foto o un color.`;
  }
  const stories = QUOTA_LIMITS.stories === 1 ? "tu historia ilustrada gratis" : `tus ${QUOTA_LIMITS.stories} historias ilustradas gratis`;
  return `Ya hiciste ${stories} de hoy. Mañana podés hacer otra; mientras, las historias en texto y las que ya hiciste siguen abiertas.`;
}

export const LIMIT_TITLE = "Por hoy llegaste al límite";

/** Lo que trae el plan gratis, para Ajustes. Sale de los mismos límites del servidor. */
export const FREE_PLAN_SUMMARY =
  `${QUOTA_LIMITS.qa} preguntas, ${QUOTA_LIMITS.voices} mensajes de Voces, ` +
  `${QUOTA_LIMITS.stories === 1 ? "1 historia ilustrada" : `${QUOTA_LIMITS.stories} historias ilustradas`} y ` +
  `${QUOTA_LIMITS.feelings} devocionales de Sentir al día.`;
