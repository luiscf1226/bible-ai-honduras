export const REMINDER_WINDOW_DAYS = 28;

function hondurasParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Tegucigalpa",
    year: "numeric",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function upcomingReminderDates(hour: number, now = new Date(), count = REMINDER_WINDOW_DAYS) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("La hora del recordatorio debe estar entre 0 y 23.");
  }

  const honduras = hondurasParts(now);
  const startOffset = honduras.hour > hour || (honduras.hour === hour && honduras.minute >= 0) ? 1 : 0;

  return Array.from({ length: count }, (_, index) => addDays(honduras.date, startOffset + index));
}
