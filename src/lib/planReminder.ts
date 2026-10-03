import { occasionsOn, type PersonalDates } from "../../convex/personalDates";
import { OCCASION_REMINDER_LINE, occasionTitle } from "../features/personal/personalDates";
import { formatReadingsLabel, type PlanReading } from "../features/reading/planReadingsLabel";

/**
 * Qué dice el recordatorio diario de cada fecha (#153): la lectura de hoy del
 * plan abierto más recientemente, o el versículo del devocional si no hay plan
 * que mencionar. Puro y sin react-native (mismo criterio que
 * `planReadingsLabel.ts`): se testea en vitest sin el runtime de la app.
 *
 * Misma forma que `ReminderPlanCandidate` de `convex/readingPlans.ts`
 * (`readingPlans.reminderCandidates`), redeclarada acá para no acoplar el
 * cliente al backend.
 */
export type ReminderPlanCandidate = {
  planId: string;
  planName: string;
  totalDays: number;
  completedCount: number;
  /** Última vez (ms) que se empezó el plan o se marcó un día. */
  lastActivityAt: number;
  /** Solo las fechas que caen dentro del plan. */
  days: readonly { date: string; day: number; completed: boolean; readings: readonly PlanReading[] }[];
};

export type ReminderPlanReading = { planId: string; planName: string; readings: readonly PlanReading[] };

export type ReminderContent = {
  title: string;
  body: string;
  /** Plan mencionado, si el aviso habla de un plan. */
  planId?: string;
};

/**
 * El plan que menciona el aviso de `date`. Entre los planes que tienen lectura
 * ese día, gana el que el usuario abrió más recientemente (empezar o marcar un
 * día). Se descartan:
 * - los planes terminados (todos los días marcados),
 * - los que ese día ya no corren (antes del inicio o después del último día:
 *   un recorrido de 7 días deja de aparecer cuando termina),
 * - el día que ya se marcó por adelantado — no tiene sentido pedir leer algo ya
 *   leído; si no queda otro plan, el aviso vuelve al versículo.
 *
 * Empate en `lastActivityAt`: gana el primero en orden de catálogo (el orden en
 * que llegan los candidatos), para que el resultado sea determinístico.
 */
export function pickReminderPlan(candidates: readonly ReminderPlanCandidate[], date: string): ReminderPlanReading | null {
  let best: { candidate: ReminderPlanCandidate; readings: readonly PlanReading[] } | null = null;

  for (const candidate of candidates) {
    if (candidate.completedCount >= candidate.totalDays) continue;
    const entry = candidate.days.find((day) => day.date === date);
    if (!entry || entry.completed || entry.readings.length === 0) continue;
    if (!best || candidate.lastActivityAt > best.candidate.lastActivityAt) {
      best = { candidate, readings: entry.readings };
    }
  }

  return best ? { planId: best.candidate.planId, planName: best.candidate.planName, readings: best.readings } : null;
}

/**
 * Título y cuerpo del aviso. Con plan: "Hoy: Génesis 4-5, Mateo 3, Salmos 3."
 * — solo la lectura del día, nunca cuántos días quedaron pendientes ni nada
 * que suene a "vas atrasado" (mismo criterio que "ponerme al día", #114). Sin
 * plan, el versículo del devocional, igual que antes de #153.
 */
export function reminderContent(verseRef: string, plan: ReminderPlanReading | null): ReminderContent {
  if (!plan) {
    return { title: "Devocional de hoy", body: `Lectura de hoy: ${verseRef}.` };
  }
  return {
    title: `Tu lectura de hoy · ${plan.planName}`,
    body: `Hoy: ${formatReadingsLabel(plan.readings)}.`,
    planId: plan.planId,
  };
}

/** Tus fechas (#204) de la persona, para que el aviso de ese día la salude. */
export type ReminderPersonal = { dates: PersonalDates; name?: string | null };

/**
 * El día de su cumpleaños o de su bautismo, el aviso la saluda por título y
 * avisa que hay un versículo en el inicio; la lectura (plan o devocional)
 * sigue en el cuerpo.
 */
export function withPersonalOccasion(date: string, content: ReminderContent, personal?: ReminderPersonal | null): ReminderContent {
  const occasion = personal ? occasionsOn(personal.dates, date)[0] : undefined;
  if (!occasion) return content;
  return { ...content, title: occasionTitle(occasion, personal?.name), body: `${OCCASION_REMINDER_LINE} ${content.body}` };
}

/** Contenido del aviso de cada fecha, en el mismo orden que `devotionals`. */
export function buildReminderContents(
  devotionals: readonly { date: string; verseRef: string }[],
  candidates: readonly ReminderPlanCandidate[],
  personal?: ReminderPersonal | null,
): ({ date: string } & ReminderContent)[] {
  return devotionals.map(({ date, verseRef }) => ({
    date,
    ...withPersonalOccasion(date, reminderContent(verseRef, pickReminderPlan(candidates, date)), personal),
  }));
}
