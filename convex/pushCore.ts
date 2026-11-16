/**
 * Avisos push (1.0.4). Puro: sin Convex ni red, para poder testearlo.
 *
 * El servidor decide todo lo que se ve y a dónde lleva: el teléfono muestra
 * `title`/`body` y, al tocar, abre `data.url` (una ruta de la app). Así un
 * aviso nuevo, o un cambio de texto, sale sin sacar otra versión.
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

/** Canal de Android de los avisos de amigos (lo crea la app, con sonido y banner). */
export const FRIENDS_CHANNEL = "amigos";

/** Teléfonos por cuenta: al pasar el tope se olvida el que hace más tiempo no se vio. */
export const MAX_TOKENS_PER_USER = 5;

/** Expo deja mandar hasta 100 avisos y pedir hasta 1000 recibos por llamada. */
export const SEND_BATCH = 100;
export const RECEIPTS_BATCH = 1000;

/** Los recibos de Apple y Google tardan: se revisan a los 15 minutos. */
export const RECEIPTS_DELAY_MS = 15 * 60 * 1000;

/**
 * Con mensajes sin leer en esa conversación, un mensaje nuevo solo avisa si el
 * anterior fue hace más de esto: una conversación seguida suena una vez.
 */
export const MESSAGE_PUSH_QUIET_MS = 5 * 60 * 1000;

const BODY_MAX_LENGTH = 140;

export type PushPlatform = "ios" | "android";

export type PushNotice = {
  title: string;
  body: string;
  /** Lo que lee la app al tocar: `kind` para estadísticas, `url` para abrir. */
  data: { kind: string; url: string };
  channelId?: string;
};

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]\s]{1,200}\]$/.test(token);
}

function clip(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > BODY_MAX_LENGTH ? `${oneLine.slice(0, BODY_MAX_LENGTH - 1).trimEnd()}…` : oneLine;
}

function chatUrl(friendshipId: string): string {
  return `/amigos/${friendshipId}`;
}

export function friendRequestNotice(fromName: string, friendshipId: string): PushNotice {
  return {
    title: "Nueva solicitud de amistad",
    body: `${fromName} quiere ser tu amigo en 3C.`,
    data: { kind: "friend_request", url: chatUrl(friendshipId) },
    channelId: FRIENDS_CHANNEL,
  };
}

export function friendAcceptedNotice(fromName: string, friendshipId: string): PushNotice {
  return {
    title: `${fromName} aceptó tu solicitud`,
    body: "Ya son amigos. Escribile o mandale un versículo.",
    data: { kind: "friend_accepted", url: chatUrl(friendshipId) },
    channelId: FRIENDS_CHANNEL,
  };
}

export function friendMessageNotice(
  fromName: string,
  friendshipId: string,
  message: { kind: "text"; text: string } | { kind: "verse"; label: string },
): PushNotice {
  return {
    title: fromName,
    body: message.kind === "verse" ? `Te mandó un versículo: ${message.label}` : clip(message.text),
    data: { kind: "friend_message", url: chatUrl(friendshipId) },
    channelId: FRIENDS_CHANNEL,
  };
}

/**
 * Si un mensaje nuevo avisa. Sin nada pendiente, siempre; con mensajes sin
 * leer, solo si la conversación estuvo callada `MESSAGE_PUSH_QUIET_MS`.
 */
export function shouldPushMessage(input: { unreadBefore: number; lastMessageAt: number | undefined; now: number }): boolean {
  if (input.unreadBefore === 0 || input.lastMessageAt === undefined) return true;
  return input.now - input.lastMessageAt >= MESSAGE_PUSH_QUIET_MS;
}

export type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

/** El teléfono ya no recibe avisos (desinstaló la app o cambió el token): se borra. */
export function isDeadDevice(result: { status: string; details?: { error?: string } }): boolean {
  return result.status === "error" && result.details?.error === "DeviceNotRegistered";
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}
