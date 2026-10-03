/**
 * Tus fechas (#204): cumpleaños y fecha de bautismo o conversión.
 *
 * Puro y sin runtime de Convex ni de React Native: lo usan la mutation que
 * guarda las fechas (`users.setPersonalDates`), la tarjeta del inicio, el
 * formulario de Mi espacio y el recordatorio diario. Así la regla de "qué día
 * se saluda" vive en un solo lugar y se testea en vitest.
 *
 * Formatos guardados en `users`:
 * - `birthday`: `MM-DD`. Solo día y mes; el año no hace falta (issue #204).
 * - `faithDate`: `YYYY-MM-DD`. El año sí, para decir "hace 3 años".
 * - `faithDateKind`: si esa fecha es de bautismo o de conversión.
 */

export type FaithDateKind = "bautismo" | "conversion";

export type PersonalDates = {
  birthday?: string | null;
  faithDate?: string | null;
  faithDateKind?: FaithDateKind | null;
};

export type MonthDay = { month: number; day: number };
export type CalendarDate = MonthDay & { year: number };

export type PersonalOccasion =
  | { kind: "cumpleanos"; verseRef: string }
  | { kind: FaithDateKind; years: number; verseRef: string };

/** Año más viejo que se acepta para un bautismo o una conversión. */
export const MIN_FAITH_YEAR = 1900;

/**
 * Versículos curados (sin IA, regla dura #4). Son referencias: el texto sale
 * siempre del corpus (`rag.verses.citedForUser`), en la versión de la persona.
 * Uno por año, en orden, para que no se repita el mismo cada cumpleaños.
 */
export const BIRTHDAY_VERSES = [
  "Salmos 139:14",
  "Salmos 90:12",
  "Números 6:24",
  "Salmos 118:24",
  "Lamentaciones 3:23",
  "Jeremías 29:11",
] as const;

export const FAITH_VERSES = [
  "2 Corintios 5:17",
  "Romanos 6:4",
  "Gálatas 2:20",
  "Filipenses 1:6",
  "Colosenses 2:12",
  "1 Pedro 1:3",
] as const;

const MONTH_DAY = /^(\d{2})-(\d{2})$/;
const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `MM-DD` válido (el 29 de febrero también) → mes y día; si no, null. */
export function parseBirthday(value: string | null | undefined): MonthDay | null {
  const match = value?.match(MONTH_DAY);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  // 2000 es bisiesto: el 29 de febrero es un cumpleaños válido.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month, 2000)) return null;
  return { month, day };
}

/** `YYYY-MM-DD` de un día que existe, desde `MIN_FAITH_YEAR`; si no, null. */
export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  const match = value?.match(FULL_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_FAITH_YEAR || month < 1 || month > 12 || day < 1 || day > daysInMonth(month, year)) return null;
  return { year, month, day };
}

export function formatBirthday({ month, day }: MonthDay): string {
  return `${pad(month)}-${pad(day)}`;
}

export function formatCalendarDate({ year, month, day }: CalendarDate): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * El día del año `year` en que se celebra una fecha: el 29 de febrero se
 * celebra el 28 en los años que no son bisiestos (issue #204).
 */
export function observedDay({ month, day }: MonthDay, year: number): MonthDay {
  if (month === 2 && day === 29 && !isLeapYear(year)) return { month: 2, day: 28 };
  return { month, day };
}

/**
 * La fecha (`YYYY-MM-DD`) de `now` en una zona horaria. Sin `timeZone` usa la
 * del teléfono: la tarjeta aparece según la fecha local de quien la ve, no la
 * del servidor ni la de Honduras.
 */
export function localDateKey(now: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function sameDay(date: MonthDay, today: CalendarDate): boolean {
  const observed = observedDay(date, today.year);
  return observed.month === today.month && observed.day === today.day;
}

function verseForYear(verses: readonly string[], year: number): string {
  return verses[((year % verses.length) + verses.length) % verses.length];
}

/**
 * Lo que se celebra el día `dateKey` (`YYYY-MM-DD`): cumpleaños primero, después
 * bautismo o conversión. Vacío si no hay fechas o no es ese día — y entonces el
 * inicio queda como siempre. El aniversario se cuenta desde el primer año: el
 * mismo día en que pasó no hay "hace 0 años".
 */
export function occasionsOn(dates: PersonalDates | null | undefined, dateKey: string): PersonalOccasion[] {
  const today = parseCalendarDate(dateKey);
  if (!dates || !today) return [];
  const occasions: PersonalOccasion[] = [];

  const birthday = parseBirthday(dates.birthday);
  if (birthday && sameDay(birthday, today)) {
    occasions.push({ kind: "cumpleanos", verseRef: verseForYear(BIRTHDAY_VERSES, today.year) });
  }

  const faith = parseCalendarDate(dates.faithDate);
  const years = faith ? today.year - faith.year : 0;
  if (faith && years >= 1 && sameDay(faith, today)) {
    occasions.push({ kind: dates.faithDateKind ?? "bautismo", years, verseRef: verseForYear(FAITH_VERSES, today.year) });
  }

  return occasions;
}
