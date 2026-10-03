import { formatReadingsLabel, type PlanReading } from "../reading/planReadingsLabel";
import { hondurasMidnight, hondurasToday, truncateAtWord, WIDGET_BRAND, WIDGET_PALETTE, WIDGET_TYPE } from "./verseWidget";

/**
 * Widget "Tu lectura de hoy" (#184): la lectura del día del plan activo y la
 * racha, en la pantalla de inicio (iOS y Android) y en la pantalla bloqueada
 * (iOS). Segunda variante del widget del versículo (#170/#180): misma paleta,
 * mismos tamaños de letra y la misma idea de línea de tiempo — la app deja
 * varios días armados y el widget avanza solo a la medianoche de Honduras.
 *
 * Puro y sin react-native: se testea en vitest.
 */

/** Misma forma que `readingPlans.reminderCandidates`, redeclarada para no acoplar el cliente al backend. */
export type PlanCandidate = {
  planId: string;
  planName: string;
  totalDays: number;
  completedCount: number;
  lastActivityAt: number;
  days: readonly { date: string; day: number; completed: boolean; readings: readonly PlanReading[] }[];
};

/** Lo que importa de `readingPlans.myPlans` para la racha. */
export type PlanStreak = { planId: string; currentStreak: number; lastCompletedDate?: string };

/** Lo que el widget necesita de un día. Se guarda tal cual (Android lo lee sin conexión). */
export type ReadingWidgetDay =
  | {
      date: string;
      kind: "reading";
      planId: string;
      planName: string;
      day: number;
      totalDays: number;
      readingsLabel: string;
      completed: boolean;
      streak: number;
    }
  | { date: string; kind: "noPlan" };

/** Cuántos días por delante deja armados la app. */
export const READING_WIDGET_WINDOW_DAYS = 14;

export const READING_WIDGET_TITLE = "Tu lectura de hoy";
export const READING_WIDGET_NO_DATA = "Abrí la app para ver tu lectura de hoy.";
export const READING_WIDGET_NO_PLAN = "Elegí un plan de lectura y tu lectura del día aparece acá.";
export const READING_WIDGET_DONE = "Ya la leíste hoy.";

/** Abre el plan, que muestra arriba la lectura del día. Sin plan, la pantalla del plan anual para empezarlo. */
export const READING_WIDGET_PLAN_URL = "bibleai://leer/plan";

export function readingWidgetUrl(planId?: string): string {
  return planId ? `${READING_WIDGET_PLAN_URL}?planId=${encodeURIComponent(planId)}` : READING_WIDGET_PLAN_URL;
}

const MAX_READINGS_CHARS = 60;
const MAX_PLAN_NAME_CHARS = 28;
const MAX_INLINE_CHARS = 32;

/** Fechas YYYY-MM-DD desde `today`, una por día. */
export function upcomingDates(today: string, count = READING_WIDGET_WINDOW_DAYS): string[] {
  const start = hondurasMidnight(today).getTime();
  return Array.from({ length: count }, (_, index) => new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

function previousDate(date: string): string {
  return new Date(hondurasMidnight(date).getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * La racha que se ve en `date`: la guardada solo si sigue viva (se marcó algo
 * ese día o el anterior). El backend no la pone en cero cuando se corta, así
 * que sin esto el widget mostraría una racha que ya no existe.
 */
export function streakOn(streak: PlanStreak | undefined, date: string): number {
  if (!streak?.lastCompletedDate || streak.currentStreak <= 0) return 0;
  const alive = streak.lastCompletedDate === date || streak.lastCompletedDate === previousDate(date);
  return alive ? streak.currentStreak : 0;
}

/**
 * El plan de `date`: entre los que tienen lectura ese día y no están
 * terminados, el que se abrió más recientemente (mismo criterio que el
 * recordatorio, #153). A diferencia del recordatorio, un día ya marcado no se
 * descarta: el widget lo muestra como leído. Empate: el primero en el orden
 * del catálogo.
 */
export function pickWidgetPlan(candidates: readonly PlanCandidate[], date: string) {
  let best: { candidate: PlanCandidate; entry: PlanCandidate["days"][number] } | null = null;
  for (const candidate of candidates) {
    if (candidate.completedCount >= candidate.totalDays) continue;
    const entry = candidate.days.find((day) => day.date === date);
    if (!entry || entry.readings.length === 0) continue;
    if (!best || candidate.lastActivityAt > best.candidate.lastActivityAt) best = { candidate, entry };
  }
  return best;
}

/** Un día del widget por cada fecha pedida. */
export function readingWidgetDays(
  candidates: readonly PlanCandidate[],
  streaks: readonly PlanStreak[],
  dates: readonly string[],
): ReadingWidgetDay[] {
  return dates.map((date) => {
    const picked = pickWidgetPlan(candidates, date);
    if (!picked) return { date, kind: "noPlan" };
    const { candidate, entry } = picked;
    return {
      date,
      kind: "reading",
      planId: candidate.planId,
      planName: candidate.planName,
      day: entry.day,
      totalDays: candidate.totalDays,
      readingsLabel: formatReadingsLabel(entry.readings),
      completed: entry.completed,
      streak: streakOn(
        streaks.find((streak) => streak.planId === candidate.planId),
        date,
      ),
    };
  });
}

/** El día de hoy, exacto. Si lo que bajó la app ya no llega a hoy, null: una lectura vieja confunde. */
export function readingDayFor(days: readonly ReadingWidgetDay[], today: string): ReadingWidgetDay | null {
  return days.find((day) => day.date === today) ?? null;
}

export function streakLabel(streak: number): string {
  return streak === 1 ? "Racha: 1 día" : `Racha: ${streak} días`;
}

export type ReadingWidgetProps = {
  /** Línea de arriba: el plan, o "Tu lectura de hoy" si no hay qué mostrar. */
  title: string;
  /** Lo principal: las lecturas, o el mensaje del estado. */
  headline: string;
  /** "Día 12 de 365" o "Ya la leíste hoy."; vacío si no aplica. */
  detail: string;
  /** Racha, o la marca si no hay racha. */
  footer: string;
  /** Pantalla bloqueada, en una línea. */
  inline: string;
  /** true cuando `headline` es una lectura (va en serif); false si es un aviso. */
  hasReading: boolean;
  url: string;
  palette: typeof WIDGET_PALETTE;
  type: typeof WIDGET_TYPE;
};

const base = { palette: WIDGET_PALETTE, type: WIDGET_TYPE };

function messageProps(headline: string, url: string): ReadingWidgetProps {
  return {
    ...base,
    title: READING_WIDGET_TITLE,
    headline,
    detail: "",
    footer: WIDGET_BRAND,
    inline: READING_WIDGET_TITLE,
    hasReading: false,
    url,
  };
}

/**
 * Lo que pinta el widget. Con el bloqueo de #171 activo (`locked`) no sale
 * nada personal — ni plan, ni lecturas, ni racha — y ni siquiera se le pasa
 * al widget: la app nunca escribe esos datos en el almacenamiento compartido.
 */
export function readingWidgetProps(day: ReadingWidgetDay | null, options: { locked: boolean }): ReadingWidgetProps {
  if (options.locked) return messageProps(READING_WIDGET_NO_DATA, READING_WIDGET_PLAN_URL);
  if (!day) return messageProps(READING_WIDGET_NO_DATA, READING_WIDGET_PLAN_URL);
  if (day.kind === "noPlan") return messageProps(READING_WIDGET_NO_PLAN, READING_WIDGET_PLAN_URL);

  const readings = truncateAtWord(day.readingsLabel, MAX_READINGS_CHARS);
  return {
    ...base,
    title: truncateAtWord(day.planName, MAX_PLAN_NAME_CHARS),
    headline: readings,
    detail: day.completed ? READING_WIDGET_DONE : `Día ${day.day} de ${day.totalDays}`,
    footer: day.streak > 0 ? streakLabel(day.streak) : WIDGET_BRAND,
    inline: truncateAtWord(`Hoy: ${day.readingsLabel}`, MAX_INLINE_CHARS),
    hasReading: true,
    url: readingWidgetUrl(day.planId),
  };
}

/**
 * Línea de tiempo para iOS: hoy ya, y cada día siguiente a su medianoche.
 * Después del último día armado va una entrada más con el aviso de abrir la
 * app, para que el widget no se quede mostrando una lectura vencida.
 */
export function readingWidgetTimeline(days: readonly ReadingWidgetDay[], options: { locked: boolean }, now = Date.now()) {
  const today = hondurasToday(now);
  const upcoming = days.filter((day) => day.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const entries = [
    { date: new Date(now), props: readingWidgetProps(readingDayFor(days, today), options) },
    ...upcoming.map((day) => ({ date: hondurasMidnight(day.date), props: readingWidgetProps(day, options) })),
  ];
  if (options.locked) return entries.slice(0, 1);
  const last = upcoming[upcoming.length - 1]?.date ?? (readingDayFor(days, today) ? today : null);
  if (last) {
    entries.push({ date: hondurasMidnight(upcomingDates(last, 2)[1]), props: readingWidgetProps(null, options) });
  }
  return entries;
}
