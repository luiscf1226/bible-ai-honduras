import { nextReviewLabel } from "../../../convex/memorizeSchedule";

/**
 * Repaso del día de Memorizar (#158): qué versículos entran, en qué orden y
 * qué se le dice a la persona después de cada uno. Lógica pura.
 *
 * La sesión es una foto de los versículos que tocaban al abrir la pantalla:
 * si uno se falla, el backend lo deja para hoy, pero no se repite en la misma
 * vuelta (sería frustrante). Al final se ofrece "Repasar los que fallé".
 */

export type SessionItem = { id: string; due: boolean; text: string | null };

/** Los que tocan hoy y tienen texto en el corpus (sin texto no hay ejercicio). */
export function startSession(items: readonly SessionItem[]): string[] {
  return items.filter((item) => item.due && item.text !== null).map((item) => item.id);
}

export function nextPending(session: readonly string[], results: Readonly<Record<string, boolean>>): string | null {
  return session.find((id) => results[id] === undefined) ?? null;
}

export function sessionSummary(session: readonly string[], results: Readonly<Record<string, boolean>>) {
  const answered = session.filter((id) => results[id] !== undefined);
  const failedIds = answered.filter((id) => results[id] === false);
  return { total: session.length, correct: answered.length - failedIds.length, failedIds };
}

/** "1 de 3" para la etiqueta del ejercicio. */
export function sessionProgress(session: readonly string[], current: string): string {
  return `${session.indexOf(current) + 1} de ${session.length}`;
}

/** Lo que se dice después de revisar un ejercicio. */
export function reviewFeedback(correct: boolean, nextReview: string, today: string): string {
  if (!correct) {
    return "Casi. Leelo con calma: queda para repasarlo hoy otra vez.";
  }
  const when = nextReviewLabel(nextReview, today);
  return `¡Bien! Vuelve a tu repaso ${when === "Mañana" ? "mañana" : when.toLowerCase()}.`;
}

export function summaryCopy(summary: { total: number; correct: number }): string {
  if (summary.total === 0) return "Nada para repasar hoy.";
  if (summary.correct === summary.total) {
    return summary.total === 1 ? "Acertaste el versículo de hoy." : `Acertaste los ${summary.total} versículos de hoy.`;
  }
  return `Acertaste ${summary.correct} de ${summary.total}. Los que fallaste quedan para hoy.`;
}
