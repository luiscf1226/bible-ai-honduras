/**
 * Diario de oración (#159): textos y orden de la lista, sin React para poder
 * testearlos. Las peticiones son privadas: nada de acá arma un texto para
 * compartir ni para la IA.
 */

/** Igual que el backend (`PRAYER_TEXT_MAX_LENGTH`): el campo corta acá. */
export const PRAYER_MAX_LENGTH = 500;

export type PrayerFilter = "abiertas" | "respondidas";

export type PrayerItem = {
  id: string;
  text: string;
  createdAt: number;
  answeredAt: number | null;
  answerNote: string | null;
  verse: { book: string; chapter: number; verse: number } | null;
};

/**
 * Borrador de "Guardar como petición" al cerrar un devocional de Sentir: lo
 * que la persona escribió con sus palabras, o los sentimientos que eligió.
 * Siempre se puede editar antes de guardar. Un devocional abierto desde el
 * historial no guarda qué se eligió, así que arranca vacío.
 */
export function prayerDraft(feelings: readonly string[], note: string): string {
  const own = note.trim();
  if (own) return own.slice(0, PRAYER_MAX_LENGTH);
  return feelings.join(" · ");
}

export function splitPrayers<T extends { answeredAt: number | null }>(items: readonly T[]) {
  return {
    open: items.filter((item) => item.answeredAt === null),
    answered: items.filter((item) => item.answeredAt !== null),
  };
}

export function prayerFilterOptions(items: readonly { answeredAt: number | null }[]) {
  const { open, answered } = splitPrayers(items);
  return [
    { id: "abiertas" as const, label: `Abiertas (${open.length})` },
    { id: "respondidas" as const, label: `Respondidas (${answered.length})` },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function hondurasDay(at: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date(at));
}

function dayLabel(at: number, now: number): string {
  const day = hondurasDay(at);
  if (day === hondurasDay(now)) return "hoy";
  if (day === hondurasDay(now - DAY_MS)) return "ayer";
  const date = new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(at));
  return `el ${date}`;
}

/** "Pedida hoy" · "Respondida ayer · pedida el 2 oct". */
export function prayerDateLabel(item: { createdAt: number; answeredAt: number | null }, now: number = Date.now()): string {
  const asked = `pedida ${dayLabel(item.createdAt, now)}`;
  if (item.answeredAt === null) {
    return asked.charAt(0).toUpperCase() + asked.slice(1);
  }
  return `Respondida ${dayLabel(item.answeredAt, now)} · ${asked}`;
}

/** Texto de la lista vacía de cada pestaña. */
export function emptyPrayersCopy(filter: PrayerFilter): string {
  return filter === "abiertas"
    ? "No tenés peticiones abiertas. Escribí una arriba o guardala al terminar un devocional de Sentir."
    : "Cuando Dios responda una petición, marcala como respondida y va a quedar aquí, para recordarlo.";
}
