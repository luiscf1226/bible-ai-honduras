import { parseReferralCode } from "./referralCode";

/**
 * Amigos y chat 1 a 1 (1.0.3). Lógica pura: la importan el backend
 * (`friends.ts`), la app y los tests. Sin funciones de Convex.
 *
 * El código de amigo es el mismo `referralCode` de la cuenta ("BAH-" + 7):
 * ya es corto, legible, está indexado y se comparte por WhatsApp. Un link de
 * amigo también cuenta como invitación (PRD §9b).
 */

/** Largo máximo de un mensaje de texto. */
export const MESSAGE_MAX_LENGTH = 1000;
/** Límite de ritmo: tantos mensajes por minuto, por persona. */
export const MESSAGES_PER_MINUTE = 20;
export const RATE_WINDOW_MS = 60_000;
/** Amistades + solicitudes por cuenta. Frena el spam de solicitudes. */
export const MAX_CONNECTIONS = 250;
/**
 * Solicitudes que una cuenta puede mandar por día. Cuentan también las que
 * después canceló: pedir y cancelar en bucle no sale gratis.
 */
export const REQUESTS_PER_DAY = 20;
/** Solicitudes a la misma persona por semana. */
export const REQUESTS_PER_TARGET_PER_WEEK = 3;
/** Después de que te rechazan, tantos días sin poder pedirle de nuevo. */
export const DECLINED_COOLDOWN_DAYS = 7;
/** Mensajes por página del chat; "Ver mensajes anteriores" trae otra igual. */
export const THREAD_PAGE_SIZE = 50;
/** Mensajes de la otra persona que se revisan para armar la evidencia de un reporte. */
export const REPORT_SCAN = 200;
/** Largo de la vista previa del último mensaje que se guarda en la amistad. */
export const PREVIEW_MAX_LENGTH = 120;
/** Arriba de esto el contador dice "99+". */
export const UNREAD_CAP = 99;
/** Un versículo enviado lleva hasta tantos versículos seguidos. */
export const MAX_VERSE_SPAN = 10;
/** Reportes por persona por día (spike de moderación §5). */
export const REPORTS_PER_DAY = 10;
/**
 * Personas distintas que tienen que reportar a alguien para que Amigos lo suspenda solo, sin
 * esperar a que el fundador lea la cola (Apple 1.2 pide actuar sobre los reportes). Solo
 * cuenta un reporte de una amistad aceptada por los dos y con al menos un mensaje de la
 * persona reportada (`reportCountsForSuspension`): tres cuentas nuevas no pueden sacar a
 * alguien que nunca les escribió.
 */
export const AUTO_SUSPEND_REPORTERS = 3;
/** Cuántos mensajes de la otra persona se copian como evidencia de un reporte. */
export const REPORT_EVIDENCE = 5;

/** Normas de Amigos: se aceptan una vez, la primera vez que se entra. */
export const COMMUNITY_RULES = [
  "Cero tolerancia a contenido ofensivo o abuso: insultos, acoso, contenido sexual, estafas o amenazas.",
  "Solo te escriben las personas que vos aceptás como amigos.",
  "Si alguien te falta el respeto, reportalo o bloquealo desde el chat. Revisamos cada reporte en menos de 24 horas y sacamos de la app a quien no respete estas normas.",
  "Los mensajes con groserías no se envían.",
] as const;

// ── Pares ────────────────────────────────────────────────

/** Una sola fila por par: el id menor va en `userA`. */
export function orderedPair<T extends string>(one: T, other: T): { userA: T; userB: T } {
  return one < other ? { userA: one, userB: other } : { userA: other, userB: one };
}

export type FriendshipSide = { userA: string; userB: string };

/** El otro lado del par, o null si `me` no es parte. */
export function otherSide<T extends string>(row: { userA: T; userB: T }, me: T): T | null {
  if (row.userA === me) return row.userB;
  if (row.userB === me) return row.userA;
  return null;
}

/** Qué campo de "leído hasta" es el mío. */
export function readField(row: FriendshipSide, me: string): "readAtA" | "readAtB" {
  return row.userA === me ? "readAtA" : "readAtB";
}

/** Qué contador de no leídos es el mío. */
export function unreadField(row: FriendshipSide, me: string): "unreadA" | "unreadB" {
  return row.userA === me ? "unreadA" : "unreadB";
}

/** Filas en que se reparten los mensajes de un día en `friendDailyStats`. */
export const DAILY_STATS_SHARDS = 8;

/** El día de Honduras (UTC−6, sin horario de verano) de un instante: "2026-11-08". */
export function hondurasDay(ms: number): string {
  return new Date(ms - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** En qué fila del día cuenta un mensaje: fija por amistad, repartida entre amistades. */
export function statsShard(friendshipId: string): number {
  let hash = 0;
  for (let index = 0; index < friendshipId.length; index += 1) hash = (hash * 31 + friendshipId.charCodeAt(index)) >>> 0;
  return hash % DAILY_STATS_SHARDS;
}

// ── Lo que se ve de cada persona ─────────────────────────

/**
 * Nombre que ven los demás: el primer nombre y la inicial del apellido
 * ("Ana L."). Alcanza para reconocer a un amigo y no expone el nombre
 * completo a quien solo tiene el código. Sin nombre no se cae al correo.
 */
export function friendDisplayName(name: string | undefined | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const [first, second] = parts;
  if (!first) return "Sin nombre";
  return second ? `${first} ${second[0]!.toUpperCase()}.` : first;
}

/** Inicial para el círculo del avatar. */
export function friendInitial(displayName: string): string {
  return (displayName.trim()[0] ?? "?").toUpperCase();
}

// ── Código y link ────────────────────────────────────────

export function parseFriendCode(raw: string | null | undefined): string | null {
  return parseReferralCode(raw);
}

/**
 * El código de un link de la app (`bibleai://amigo?code=…`) o del sitio
 * (`…/?ref=BAH-…&amigo=1`). Cualquier otra cosa → null.
 */
export function friendCodeFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== "string" || !url.includes("?")) return null;
  const params = new Map<string, string>();
  for (const part of url.slice(url.indexOf("?") + 1).split(/[&#]/)) {
    const [key, value = ""] = part.split("=");
    if (!key) continue;
    try {
      params.set(key, decodeURIComponent(value.replace(/\+/g, " ")));
    } catch {
      return null;
    }
  }
  const isAppLink = /^bibleai:\/\/amigo\b/.test(url);
  if (isAppLink) return parseFriendCode(params.get("code"));
  return params.has("amigo") ? parseFriendCode(params.get("ref")) : null;
}

export function friendInviteAppLink(code: string): string {
  return `bibleai://amigo?code=${code}`;
}

/** Texto que acompaña el link en WhatsApp. El link lo arma `src/lib/share.ts`. */
export function friendInviteMessage(code: string): string {
  return `Agregame como amigo en 3C para mandarnos versículos y escribirnos. Mi código es ${code}. Abrí el link:`;
}

// ── Mensajes ─────────────────────────────────────────────

/** Saca espacios de los bordes y deja como mucho una línea en blanco seguida. */
export function cleanMessageText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type VerseRef = { book: string; chapter: number; verse: number; verseEnd?: number };

/** "Juan 3:16" o "Salmos 23:1-4". */
export function verseLabel(ref: VerseRef): string {
  const end = ref.verseEnd !== undefined && ref.verseEnd > ref.verse ? `-${ref.verseEnd}` : "";
  return `${ref.book} ${ref.chapter}:${ref.verse}${end}`;
}

/** El último versículo del rango, acotado a `MAX_VERSE_SPAN`. null si el rango no sirve. */
export function verseRangeEnd(ref: VerseRef): number | null {
  if (![ref.chapter, ref.verse].every((n) => Number.isInteger(n) && n >= 1)) return null;
  if (ref.verseEnd === undefined || ref.verseEnd <= ref.verse) return ref.verse;
  if (!Number.isInteger(ref.verseEnd)) return null;
  return Math.min(ref.verseEnd, ref.verse + MAX_VERSE_SPAN - 1);
}

type PreviewMessage = { kind: "text" | "verse"; text?: string; verse?: VerseRef; fromMe: boolean };

/**
 * Lo que se guarda en la amistad como vista previa del último mensaje: el
 * texto en una línea y recortado, o la cita del versículo. Así la lista de
 * amigos no lee mensajes.
 */
export function previewSnippet(message: { kind: "text" | "verse"; text?: string; verse?: VerseRef }): string {
  if (message.kind === "verse" && message.verse) return verseLabel(message.verse);
  const oneLine = (message.text ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > PREVIEW_MAX_LENGTH ? `${oneLine.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…` : oneLine;
}

/**
 * Lo que se ve debajo del nombre en la lista de amigos. Un versículo trae la
 * cita en `verse` o, ya guardada, en `text`.
 */
export function messagePreview(message: PreviewMessage | null): string {
  if (!message) return "Todavía no se han escrito";
  const body =
    message.kind === "verse" ? `Versículo · ${message.verse ? verseLabel(message.verse) : (message.text ?? "")}` : (message.text ?? "");
  const oneLine = body.replace(/\s+/g, " ").trim();
  return message.fromMe ? `Vos: ${oneLine}` : oneLine;
}

/**
 * Si un reporte cuenta para la suspensión automática: la amistad la aceptaron
 * los dos y la persona reportada le escribió al menos un mensaje a quien
 * reporta. Los demás quedan en la cola para revisión a mano.
 */
export function reportCountsForSuspension(report: { friendshipAccepted: boolean; evidenceCount: number }): boolean {
  return report.friendshipAccepted && report.evidenceCount > 0;
}

/**
 * Límite de ritmo de mensajes como balde de fichas: cabe `MESSAGES_PER_MINUTE`
 * y se rellena a ese ritmo por minuto. Vive aparte de los mensajes, así que
 * borrar la conversación no lo reinicia.
 */
export function takeRateToken(
  bucket: { tokens: number; updatedAt: number } | null,
  now: number,
): { allowed: boolean; tokens: number; updatedAt: number } {
  const elapsed = bucket ? Math.max(0, now - bucket.updatedAt) : 0;
  const refilled = bucket ? Math.min(MESSAGES_PER_MINUTE, bucket.tokens + (elapsed * MESSAGES_PER_MINUTE) / RATE_WINDOW_MS) : MESSAGES_PER_MINUTE;
  if (refilled < 1) return { allowed: false, tokens: refilled, updatedAt: now };
  return { allowed: true, tokens: refilled - 1, updatedAt: now };
}

export function unreadLabel(count: number): string {
  return count > UNREAD_CAP ? `${UNREAD_CAP}+` : String(count);
}

// ── Respuestas de las mutaciones ─────────────────────────

export type SendStatus =
  | "ok"
  | "empty"
  | "too_long"
  | "offensive"
  | "rate_limited"
  | "not_friends"
  | "rules_required"
  | "suspended"
  | "verse_not_found";

/** Aviso para cada mensaje que no se mandó. */
export function sendStatusCopy(status: Exclude<SendStatus, "ok">): string {
  switch (status) {
    case "empty":
      return "Escribí algo antes de enviar.";
    case "too_long":
      return `El mensaje es muy largo. El máximo es de ${MESSAGE_MAX_LENGTH} caracteres.`;
    case "offensive":
      return "Este mensaje no se envió porque tiene palabras ofensivas. Escribilo de otra forma.";
    case "rate_limited":
      return "Estás enviando muchos mensajes seguidos. Esperá un minuto y volvé a intentar.";
    case "not_friends":
      return "Ya no pueden escribirse en este chat.";
    case "rules_required":
      return "Primero aceptá las normas de Amigos.";
    case "suspended":
      return SUSPENDED_COPY;
    case "verse_not_found":
      return "No encontramos ese versículo.";
  }
}

export type RequestStatus =
  | "sent"
  | "accepted"
  | "already_friends"
  | "already_sent"
  | "not_found"
  | "self"
  | "too_many"
  | "daily_limit"
  | "try_later"
  | "rules_required"
  | "suspended";

export function requestStatusCopy(status: RequestStatus): string {
  switch (status) {
    case "sent":
      return "Listo. Cuando acepte, van a poder escribirse.";
    case "accepted":
      return "Ya son amigos. Te había mandado una solicitud y la aceptamos.";
    case "already_friends":
      return "Ya son amigos.";
    case "already_sent":
      return "Ya le mandaste una solicitud. Falta que la acepte.";
    case "not_found":
      return "No encontramos a nadie con ese código. Revisalo y probá otra vez.";
    case "self":
      return "Ese es tu propio código.";
    case "too_many":
      return `Llegaste al máximo de ${MAX_CONNECTIONS} amigos y solicitudes.`;
    case "daily_limit":
      return "Mandaste muchas solicitudes hoy. Probá de nuevo mañana.";
    case "try_later":
      return "Ya le mandaste solicitudes a esta persona hace poco. Probá de nuevo en unos días.";
    case "rules_required":
      return "Primero aceptá las normas de Amigos.";
    case "suspended":
      return SUSPENDED_COPY;
  }
}

const SUSPENDED_COPY = "Tu cuenta ya no puede escribir ni agregar amigos porque no respetó las normas de Amigos.";

// ── Reportes ─────────────────────────────────────────────

/**
 * Motivos de reporte (spike de moderación §3): una sola elección, sin texto
 * libre. Doctrina no es motivo.
 */
export const REPORT_REASONS = [
  { id: "ofensivo", label: "Insultos, odio o acoso" },
  { id: "sexual", label: "Contenido sexual" },
  { id: "estafa", label: "Ventas, préstamos o estafas" },
  { id: "privado", label: "Datos privados de otra persona" },
  { id: "peligro", label: "Alguien está en peligro" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
