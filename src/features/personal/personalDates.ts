import {
  daysInMonth,
  formatBirthday,
  formatCalendarDate,
  MIN_FAITH_YEAR,
  parseBirthday,
  parseCalendarDate,
  type FaithDateKind,
  type PersonalOccasion,
} from "../../../convex/personalDates";

/**
 * Textos de Tus fechas (#204): la tarjeta del inicio, el formulario de Mi
 * espacio y la línea del recordatorio. La regla de qué día se saluda está en
 * `convex/personalDates.ts`; acá solo está cómo se dice.
 */

export const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const FAITH_KIND_LABELS: Record<FaithDateKind, string> = { bautismo: "Bautismo", conversion: "Conversión" };

/** "14 de marzo", o null si no hay cumpleaños guardado. */
export function describeBirthday(value: string | null | undefined): string | null {
  const birthday = parseBirthday(value);
  return birthday ? `${birthday.day} de ${MONTHS[birthday.month - 1]}` : null;
}

/** "14 de marzo de 2019", o null si no hay fecha guardada. */
export function describeFaithDate(value: string | null | undefined): string | null {
  const date = parseCalendarDate(value);
  return date ? `${date.day} de ${MONTHS[date.month - 1]} de ${date.year}` : null;
}

/** Primer nombre de lo que trae Clerk ("Ana María López" → "Ana"). */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

const FAITH_NOUN: Record<FaithDateKind, string> = { bautismo: "tu bautismo", conversion: "tu conversión" };

/** "Feliz cumpleaños, Ana" / "Hoy hace 3 años de tu bautismo". */
export function occasionTitle(occasion: PersonalOccasion, name?: string | null): string {
  if (occasion.kind === "cumpleanos") {
    const first = firstName(name);
    return first ? `Feliz cumpleaños, ${first}` : "Feliz cumpleaños";
  }
  const years = occasion.years === 1 ? "1 año" : `${occasion.years} años`;
  return `Hoy hace ${years} de ${FAITH_NOUN[occasion.kind]}`;
}

/** Rótulo chico de arriba de la tarjeta. */
export function occasionOverline(occasion: PersonalOccasion): string {
  if (occasion.kind === "cumpleanos") return "Tu cumpleaños";
  return occasion.kind === "conversion" ? "Tu conversión" : "Tu bautismo";
}

/** Cuerpo del recordatorio de ese día: se antepone a la lectura de siempre. */
export const OCCASION_REMINDER_LINE = "Tenés un versículo para este día en el inicio.";

// ── Formulario de Mi espacio ────────────────────────────────────────────────

export type DateDraft = { day: string; month: number | null; year: string };

export type DraftResult = { ok: true; value: string } | { ok: false; error: string };

function parseDay(day: string): number | null {
  const trimmed = day.trim();
  return /^\d{1,2}$/.test(trimmed) ? Number(trimmed) : null;
}

/** Día y mes del formulario → `MM-DD`. El 29 de febrero se acepta. */
export function birthdayFromDraft(draft: DateDraft): DraftResult {
  const day = parseDay(draft.day);
  if (draft.month === null) return { ok: false, error: "Elegí el mes." };
  if (day === null || day < 1 || day > daysInMonth(draft.month, 2000)) {
    return { ok: false, error: `Ese día no existe en ${MONTHS[draft.month - 1]}.` };
  }
  return { ok: true, value: formatBirthday({ month: draft.month, day }) };
}

/** Día, mes y año del formulario → `YYYY-MM-DD`, que no sea después de hoy. */
export function faithDateFromDraft(draft: DateDraft, todayKey: string): DraftResult {
  const day = parseDay(draft.day);
  const yearText = draft.year.trim();
  const year = /^\d{4}$/.test(yearText) ? Number(yearText) : null;
  if (draft.month === null) return { ok: false, error: "Elegí el mes." };
  if (year === null || year < MIN_FAITH_YEAR) return { ok: false, error: "Escribí el año con cuatro números." };
  if (day === null || day < 1 || day > daysInMonth(draft.month, year)) {
    return { ok: false, error: `Ese día no existe en ${MONTHS[draft.month - 1]} de ${year}.` };
  }
  const value = formatCalendarDate({ year, month: draft.month, day });
  if (value > todayKey) return { ok: false, error: "La fecha no puede ser después de hoy." };
  return { ok: true, value };
}

/** Lo guardado → borrador para editar. */
export function draftFromBirthday(value: string | null | undefined): DateDraft {
  const birthday = parseBirthday(value);
  return birthday ? { day: String(birthday.day), month: birthday.month, year: "" } : { day: "", month: null, year: "" };
}

export function draftFromFaithDate(value: string | null | undefined): DateDraft {
  const date = parseCalendarDate(value);
  return date ? { day: String(date.day), month: date.month, year: String(date.year) } : { day: "", month: null, year: "" };
}
