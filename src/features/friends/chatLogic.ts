/**
 * Lo que no es dibujo del chat entre amigos (1.0.3): separadores por día, la
 * hora de cada mensaje y el "Visto". Fechas siempre con el calendario de
 * Honduras, no el del teléfono.
 */

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

function dayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HONDURAS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ms),
  );
}

/** "3:45 p. m." */
export function timeLabel(ms: number): string {
  return new Intl.DateTimeFormat("es-HN", { hour: "numeric", minute: "2-digit", timeZone: HONDURAS_TIME_ZONE }).format(new Date(ms));
}

/** "Hoy", "Ayer" o "lunes 3 de noviembre". */
export function dayLabel(ms: number, now = Date.now()): string {
  const key = dayKey(ms);
  if (key === dayKey(now)) return "Hoy";
  if (key === dayKey(now - 24 * 60 * 60 * 1000)) return "Ayer";
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "long", timeZone: HONDURAS_TIME_ZONE, weekday: "long" }).format(
    new Date(ms),
  );
}

type ChatMessage = { id: string; fromMe: boolean; createdAt: number };

export type ChatItem<M extends ChatMessage> =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: M; time: string; seen: boolean };

/**
 * Mensajes con un separador cada vez que cambia el día. "Visto" va solo
 * debajo de mi último mensaje, si la otra persona ya leyó hasta ahí.
 */
export function buildChatItems<M extends ChatMessage>(messages: readonly M[], friendReadAt: number | null, now = Date.now()): ChatItem<M>[] {
  const lastMine = [...messages].reverse().find((message) => message.fromMe);
  const items: ChatItem<M>[] = [];
  let lastDay: string | null = null;
  for (const message of messages) {
    const day = dayKey(message.createdAt);
    if (day !== lastDay) {
      items.push({ kind: "day", key: `day-${day}`, label: dayLabel(message.createdAt, now) });
      lastDay = day;
    }
    items.push({
      kind: "message",
      key: message.id,
      message,
      time: timeLabel(message.createdAt),
      seen: message === lastMine && friendReadAt !== null && friendReadAt >= message.createdAt,
    });
  }
  return items;
}

/** Hora corta para la lista de amigos: la hora si es de hoy, "Ayer" o la fecha. */
export function listTimeLabel(ms: number | null, now = Date.now()): string | null {
  if (ms === null) return null;
  const label = dayLabel(ms, now);
  if (label === "Hoy") return timeLabel(ms);
  if (label === "Ayer") return label;
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: HONDURAS_TIME_ZONE }).format(new Date(ms));
}
