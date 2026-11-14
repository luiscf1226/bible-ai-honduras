import { paginationOptsValidator, type PaginationResult } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { DEFAULT_BIBLE_VERSION } from "./bibleVersions";
import { makeReferralCode } from "./users";
import { checkMessageContent } from "./chatFilter";
import { queuePush } from "./push";
import { friendAcceptedNotice, friendMessageNotice, friendRequestNotice, shouldPushMessage } from "./pushCore";
import {
  AUTO_SUSPEND_DAYS,
  AUTO_SUSPEND_REPORTERS,
  cleanMessageText,
  DECLINED_COOLDOWN_DAYS,
  friendDisplayName,
  friendInitial,
  hondurasDay,
  isFriendsSuspended,
  MAX_CONNECTIONS,
  MESSAGE_MAX_LENGTH,
  messagePreview,
  orderedPair,
  otherSide,
  parseFriendCode,
  previewSnippet,
  readField,
  readSeqField,
  REPORT_EVIDENCE,
  REPORT_SCAN,
  reportCountsForSuspension,
  REPORTS_PER_DAY,
  REQUESTS_PER_DAY,
  REQUESTS_PER_TARGET_PER_WEEK,
  type RequestStatus,
  type SendStatus,
  statsShard,
  suspendedUntil,
  takeRateToken,
  UNREAD_CAP,
  unreadField,
  verseLabel,
  verseRangeEnd,
} from "./friendsCore";

/**
 * Amigos y chat 1 a 1 (1.0.3). Se conecta con alguien por su código (o el
 * link de WhatsApp), la otra persona acepta, y desde ahí se escriben y se
 * mandan versículos. Gratis: no pasa por `convex/quotas.ts`.
 *
 * Seguridad (Apple 1.2, docs/spikes/moderacion-contenido-usuarios.md):
 * - Solo escriben amigos aceptados; sin normas aceptadas no se escribe.
 * - Filtro de groserías en el servidor (`chatFilter.ts`), largo máximo y
 *   límite de ritmo (`friendRates`, aparte de los mensajes).
 * - Topes de solicitudes por día y por persona, y espera después de un
 *   rechazo (`friendRequestEvents`, no se borra al cancelar).
 * - Reportar (con copia de lo reportado) y bloquear. Bloquear borra la
 *   amistad y su conversación, y la otra persona ya no te encuentra. Tres
 *   reportes que cuentan (`reportCountsForSuspension`) de personas distintas
 *   suspenden solos por `AUTO_SUSPEND_DAYS` días.
 * - Ningún id de usuario sale al teléfono: todo se pide por `friendshipId`
 *   o por código, y cada función verifica que seas parte del par.
 */

const reasonValidator = v.union(
  v.literal("estafa"),
  v.literal("ofensivo"),
  v.literal("sexual"),
  v.literal("privado"),
  v.literal("peligro"),
);

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
// Filas viejas de `friendRequestEvents` que se borran cada vez que se pide amistad.
const REQUEST_EVENTS_CLEANUP = 8;
// Filas por pasada al borrar la conversación de una amistad que terminó.
const PURGE_PAGE = 256;

async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user) throw new ConvexError("No autenticado");
  return user;
}

/** Por qué esta cuenta todavía no puede escribir ni agregar amigos, o null. */
function socialGate(user: Doc<"users">, now: number): "suspended" | "rules_required" | null {
  if (isFriendsSuspended(user, now)) return "suspended";
  if (user.communityRulesAcceptedAt === undefined) return "rules_required";
  return null;
}

async function connectionsOf(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"friendships">[]> {
  const asA = await ctx.db
    .query("friendships")
    .withIndex("by_userA", (q) => q.eq("userA", userId))
    .take(MAX_CONNECTIONS);
  const asB = await ctx.db
    .query("friendships")
    .withIndex("by_userB", (q) => q.eq("userB", userId))
    .take(MAX_CONNECTIONS);
  return [...asA, ...asB];
}

async function findPair(ctx: QueryCtx, one: Id<"users">, other: Id<"users">) {
  const { userA, userB } = orderedPair(one, other);
  return await ctx.db
    .query("friendships")
    .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
    .unique();
}

async function findBlock(ctx: QueryCtx, blockerId: Id<"users">, blockedId: Id<"users">) {
  return await ctx.db
    .query("userBlocks")
    .withIndex("by_blocker", (q) => q.eq("blockerId", blockerId).eq("blockedId", blockedId))
    .first();
}

async function blockedEitherWay(ctx: QueryCtx, one: Id<"users">, other: Id<"users">): Promise<boolean> {
  return (await findBlock(ctx, one, other)) !== null || (await findBlock(ctx, other, one)) !== null;
}

async function userByCode(ctx: QueryCtx, raw: string): Promise<Doc<"users"> | null> {
  const code = parseFriendCode(raw);
  if (!code) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
    .first();
}

/** La amistad (o solicitud) si sos parte, con el id de la otra persona. */
async function myFriendship(ctx: QueryCtx, friendshipId: Id<"friendships">, me: Id<"users">) {
  const row = await ctx.db.get(friendshipId);
  if (!row) return null;
  const otherId = otherSide(row, me);
  return otherId ? { row, otherId } : null;
}

/** No leídos de mi lado, del contador de la fila (sin leer mensajes). */
function unreadOf(row: Doc<"friendships">, me: Id<"users">): number {
  return row[unreadField(row, me)] ?? 0;
}

async function personCard(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const name = friendDisplayName(user?.name);
  return { name, initial: friendInitial(name) };
}

// ── Consultas ────────────────────────────────────────────

export type FriendsSummary = { friends: number; requests: number; unread: number };

/** Contadores para Inicio y Mi espacio. Ceros sin sesión. No lee mensajes. */
export const summary = query({
  args: {},
  handler: async (ctx): Promise<FriendsSummary> => {
    const user = await currentUser(ctx);
    if (!user) return { friends: 0, requests: 0, unread: 0 };
    let friends = 0;
    let requests = 0;
    let unread = 0;
    for (const row of await connectionsOf(ctx, user._id)) {
      if (row.status === "pending") {
        if (row.requestedBy !== user._id) requests += 1;
        continue;
      }
      friends += 1;
      unread += unreadOf(row, user._id);
    }
    return { friends, requests, unread };
  },
});

export type FriendRow = {
  friendshipId: Id<"friendships">;
  name: string;
  initial: string;
  preview: string;
  lastMessageAt: number | null;
  unread: number;
};

export type PendingRow = { friendshipId: Id<"friendships">; name: string; initial: string; createdAt: number };

export type FriendsOverview = {
  code: string;
  rulesAccepted: boolean;
  suspended: boolean;
  /** Fin de una suspensión automática; null si no hay o si es permanente. */
  suspendedUntil: number | null;
  requests: PendingRow[];
  sent: PendingRow[];
  friends: FriendRow[];
};

/**
 * La pantalla de Amigos: solicitudes, amigos con su último mensaje y tu
 * código. null sin sesión. La vista previa y los no leídos salen de la fila
 * de la amistad, no de los mensajes.
 */
export const overview = query({
  args: {},
  handler: async (ctx): Promise<FriendsOverview | null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const requests: PendingRow[] = [];
    const sent: PendingRow[] = [];
    const friends: (FriendRow & { sortAt: number })[] = [];

    for (const row of await connectionsOf(ctx, user._id)) {
      const otherId = otherSide(row, user._id)!;
      const card = await personCard(ctx, otherId);
      if (row.status === "pending") {
        (row.requestedBy === user._id ? sent : requests).push({ friendshipId: row._id, ...card, createdAt: row.createdAt });
        continue;
      }
      const last = row.lastMessage;
      friends.push({
        friendshipId: row._id,
        ...card,
        preview: messagePreview(last ? { kind: last.kind, text: last.snippet, fromMe: last.senderId === user._id } : null),
        lastMessageAt: row.lastMessageAt ?? null,
        unread: unreadOf(row, user._id),
        sortAt: row.lastMessageAt ?? row.acceptedAt ?? row.createdAt,
      });
    }

    requests.sort((a, b) => b.createdAt - a.createdAt);
    sent.sort((a, b) => b.createdAt - a.createdAt);
    friends.sort((a, b) => b.sortAt - a.sortAt);
    const now = Date.now();
    return {
      code: user.referralCode,
      rulesAccepted: user.communityRulesAcceptedAt !== undefined,
      suspended: isFriendsSuspended(user, now),
      suspendedUntil: suspendedUntil(user, now),
      requests,
      sent,
      friends: friends.map(({ sortAt: _sortAt, ...friend }) => friend),
    };
  },
});

export type CodePreview =
  | { status: "signed_out" | "not_found" | "self" }
  | {
      status: "ok";
      name: string;
      initial: string;
      code: string;
      relation: "none" | "friends" | "sent" | "received";
      friendshipId?: Id<"friendships">;
    };

/**
 * La tarjeta de quien te pasó su código, antes de agregarlo. Si hay un
 * bloqueo en cualquier sentido, es como si el código no existiera.
 */
export const previewByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<CodePreview> => {
    const user = await currentUser(ctx);
    if (!user) return { status: "signed_out" };
    const other = await userByCode(ctx, args.code);
    if (!other) return { status: "not_found" };
    if (other._id === user._id) return { status: "self" };
    if (await blockedEitherWay(ctx, user._id, other._id)) return { status: "not_found" };
    const name = friendDisplayName(other.name);
    const row = await findPair(ctx, user._id, other._id);
    const relation = !row
      ? "none"
      : row.status === "accepted"
        ? "friends"
        : row.requestedBy === user._id
          ? "sent"
          : "received";
    return {
      status: "ok",
      name,
      initial: friendInitial(name),
      code: other.referralCode,
      relation,
      ...(row ? { friendshipId: row._id } : {}),
    };
  },
});

export type ThreadMessage = {
  id: Id<"directMessages">;
  fromMe: boolean;
  kind: "text" | "verse";
  text?: string;
  verse?: Doc<"directMessages">["verse"];
  createdAt: number;
};

export type Thread = {
  friendshipId: Id<"friendships">;
  status: "pending" | "accepted";
  requestedByMe: boolean;
  friend: { name: string; initial: string };
  /** Hasta dónde leyó la otra persona ("Visto"). */
  friendReadAt: number | null;
  canWrite: boolean;
  gate: "suspended" | "rules_required" | null;
};

/** La cabecera de un chat: con quién, en qué estado y si se puede escribir. null si no sos parte. */
export const thread = query({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<Thread | null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return null;
    const { row, otherId } = mine;
    const gate = socialGate(user, Date.now());
    return {
      friendshipId: row._id,
      status: row.status,
      requestedByMe: row.requestedBy === user._id,
      friend: await personCard(ctx, otherId),
      friendReadAt: row[readField(row, otherId)] ?? null,
      canWrite: row.status === "accepted" && gate === null,
      gate,
    };
  },
});

const EMPTY_PAGE: PaginationResult<ThreadMessage> = { page: [], isDone: true, continueCursor: "" };

/**
 * Los mensajes de un chat, del más nuevo al más viejo, de a páginas
 * (`usePaginatedQuery`). Vacío si no sos parte.
 */
export const messages = query({
  args: { friendshipId: v.id("friendships"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<PaginationResult<ThreadMessage>> => {
    const user = await currentUser(ctx);
    if (!user) return EMPTY_PAGE;
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return EMPTY_PAGE;
    const result = await ctx.db
      .query("directMessages")
      .withIndex("by_friendship", (q) => q.eq("friendshipId", mine.row._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((message) => ({
        id: message._id,
        fromMe: message.senderId === user._id,
        kind: message.kind,
        ...(message.text !== undefined ? { text: message.text } : {}),
        ...(message.verse ? { verse: message.verse } : {}),
        createdAt: message.createdAt,
      })),
    };
  },
});

export type BlockedRow = { blockId: Id<"userBlocks">; name: string; initial: string };

/** Personas que bloqueaste, para poder desbloquearlas. */
export const blocked = query({
  args: {},
  handler: async (ctx): Promise<BlockedRow[]> => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
      .take(MAX_CONNECTIONS);
    return await Promise.all(rows.map(async (row) => ({ blockId: row._id, ...(await personCard(ctx, row.blockedId)) })));
  },
});

// ── Normas y solicitudes ─────────────────────────────────

/** "Acepto las normas" la primera vez que se entra a Amigos. */
export const acceptRules = mutation({
  args: {},
  handler: async (ctx): Promise<{ acceptedAt: number }> => {
    const user = await requireUser(ctx);
    if (user.communityRulesAcceptedAt !== undefined) return { acceptedAt: user.communityRulesAcceptedAt };
    const acceptedAt = Date.now();
    await ctx.db.patch(user._id, { communityRulesAcceptedAt: acceptedAt });
    return { acceptedAt };
  },
});

/**
 * Por qué no se puede mandar otra solicitud a esta persona todavía, o null.
 * Cuenta lo que quedó en `friendRequestEvents`, que no se borra al cancelar.
 */
async function requestLimit(
  ctx: QueryCtx,
  requesterId: Id<"users">,
  targetId: Id<"users">,
  now: number,
): Promise<"daily_limit" | "try_later" | null> {
  const today = await ctx.db
    .query("friendRequestEvents")
    .withIndex("by_requester", (q) => q.eq("requesterId", requesterId).eq("kind", "sent").gt("createdAt", now - DAY_MS))
    .take(REQUESTS_PER_DAY);
  if (today.length >= REQUESTS_PER_DAY) return "daily_limit";
  const toTarget = await ctx.db
    .query("friendRequestEvents")
    .withIndex("by_requester_target", (q) =>
      q.eq("requesterId", requesterId).eq("targetId", targetId).eq("kind", "sent").gt("createdAt", now - WEEK_MS),
    )
    .take(REQUESTS_PER_TARGET_PER_WEEK);
  if (toTarget.length >= REQUESTS_PER_TARGET_PER_WEEK) return "try_later";
  const declined = await ctx.db
    .query("friendRequestEvents")
    .withIndex("by_requester_target", (q) =>
      q
        .eq("requesterId", requesterId)
        .eq("targetId", targetId)
        .eq("kind", "declined")
        .gt("createdAt", now - DECLINED_COOLDOWN_DAYS * DAY_MS),
    )
    .first();
  return declined ? "try_later" : null;
}

/** Anota una solicitud enviada y, de paso, borra unas pocas de hace más de una semana. */
async function logRequest(ctx: MutationCtx, requesterId: Id<"users">, targetId: Id<"users">, now: number) {
  await ctx.db.insert("friendRequestEvents", { requesterId, targetId, kind: "sent", createdAt: now });
  const oldest = Math.max(WEEK_MS, DECLINED_COOLDOWN_DAYS * DAY_MS);
  const stale = await ctx.db
    .query("friendRequestEvents")
    .withIndex("by_requester_created", (q) => q.eq("requesterId", requesterId).lt("createdAt", now - oldest))
    .take(REQUEST_EVENTS_CLEANUP);
  for (const row of stale) await ctx.db.delete(row._id);
}

/**
 * Pedir amistad con un código. Si la otra persona ya te la había pedido, se
 * aceptan las dos de una vez. A quien te bloqueó (o bloqueaste) se le responde
 * igual que a un código que no existe: no se le avisa que hay un bloqueo.
 * Topes: `REQUESTS_PER_DAY` por día, `REQUESTS_PER_TARGET_PER_WEEK` a la misma
 * persona por semana, y nada a quien te rechazó en los últimos
 * `DECLINED_COOLDOWN_DAYS` días (sin decirte que te rechazó).
 */
export const request = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ status: RequestStatus; friendshipId?: Id<"friendships"> }> => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const gate = socialGate(user, now);
    if (gate) return { status: gate };
    const other = await userByCode(ctx, args.code);
    if (!other) return { status: "not_found" };
    if (other._id === user._id) return { status: "self" };
    if (await blockedEitherWay(ctx, user._id, other._id)) return { status: "not_found" };

    const existing = await findPair(ctx, user._id, other._id);
    if (existing) {
      if (existing.status === "accepted") return { status: "already_friends", friendshipId: existing._id };
      if (existing.requestedBy === user._id) return { status: "already_sent", friendshipId: existing._id };
      await acceptFriendship(ctx, existing._id, now);
      await queuePush(ctx, other._id, friendAcceptedNotice(friendDisplayName(user.name), existing._id));
      return { status: "accepted", friendshipId: existing._id };
    }

    if (
      (await connectionsOf(ctx, user._id)).length >= MAX_CONNECTIONS ||
      (await connectionsOf(ctx, other._id)).length >= MAX_CONNECTIONS
    ) {
      return { status: "too_many" };
    }
    const limit = await requestLimit(ctx, user._id, other._id, now);
    if (limit) return { status: limit };
    const friendshipId = await ctx.db.insert("friendships", {
      ...orderedPair(user._id, other._id),
      requestedBy: user._id,
      status: "pending",
      createdAt: now,
    });
    await logRequest(ctx, user._id, other._id, now);
    await queuePush(ctx, other._id, friendRequestNotice(friendDisplayName(user.name), friendshipId));
    return { status: "sent", friendshipId };
  },
});

/** Una solicitud pasa a amistad; cuenta para el dashboard. */
async function acceptFriendship(ctx: MutationCtx, friendshipId: Id<"friendships">, now: number) {
  await ctx.db.patch(friendshipId, { status: "accepted", acceptedAt: now });
  await bumpDailyStats(ctx, friendshipId, now, { accepted: 1 });
}

/** Aceptar una solicitud que te mandaron. */
export const accept = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ status: "ok" | "not_found" | "suspended" | "rules_required" }> => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const gate = socialGate(user, now);
    if (gate) return { status: gate };
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine || mine.row.status !== "pending" || mine.row.requestedBy === user._id) return { status: "not_found" };
    await acceptFriendship(ctx, mine.row._id, now);
    await queuePush(ctx, mine.otherId, friendAcceptedNotice(friendDisplayName(user.name), mine.row._id));
    return { status: "ok" };
  },
});

/** Borra la amistad y, en segundo plano, toda su conversación. */
async function endFriendship(ctx: MutationCtx, row: Doc<"friendships">): Promise<void> {
  await ctx.db.delete(row._id);
  if (row.status === "accepted") await bumpDailyStats(ctx, row._id, Date.now(), { ended: 1 });
  if (row.lastMessageAt !== undefined) {
    await ctx.scheduler.runAfter(0, internal.friends.purgeConversation, { friendshipId: row._id });
  }
}

/**
 * Rechazar una solicitud, cancelar la que mandaste o dejar de ser amigos. La
 * conversación se borra para los dos. Un rechazo queda anotado: quien pidió no
 * puede volver a pedir por `DECLINED_COOLDOWN_DAYS` días.
 */
export const remove = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ removed: boolean }> => {
    const user = await requireUser(ctx);
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return { removed: false };
    if (mine.row.status === "pending" && mine.row.requestedBy !== user._id) {
      await ctx.db.insert("friendRequestEvents", {
        requesterId: mine.otherId,
        targetId: user._id,
        kind: "declined",
        createdAt: Date.now(),
      });
    }
    await endFriendship(ctx, mine.row);
    return { removed: true };
  },
});

/** Borra la conversación de una amistad que ya no existe, de a páginas. */
export const purgeConversation = internalMutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ deleted: number }> => {
    const page = await ctx.db
      .query("directMessages")
      .withIndex("by_friendship", (q) => q.eq("friendshipId", args.friendshipId))
      .take(PURGE_PAGE);
    for (const message of page) await ctx.db.delete(message._id);
    if (page.length === PURGE_PAGE) {
      await ctx.scheduler.runAfter(0, internal.friends.purgeConversation, { friendshipId: args.friendshipId });
    }
    return { deleted: page.length };
  },
});

// ── Mensajes ─────────────────────────────────────────────

type SendTarget = { status: "ready"; user: Doc<"users">; row: Doc<"friendships"> } | { status: Exclude<SendStatus, "ok"> };

async function sendTarget(ctx: MutationCtx, friendshipId: Id<"friendships">, now: number): Promise<SendTarget> {
  const user = await requireUser(ctx);
  const gate = socialGate(user, now);
  if (gate) return { status: gate };
  const mine = await myFriendship(ctx, friendshipId, user._id);
  if (!mine || mine.row.status !== "accepted") return { status: "not_friends" };
  return { status: "ready", user, row: mine.row };
}

/**
 * Gasta una ficha del límite de ritmo. Va justo antes de guardar, después del
 * filtro: un mensaje rechazado no gasta. La fila vive aparte de los mensajes.
 */
async function spendRateToken(ctx: MutationCtx, userId: Id<"users">, now: number): Promise<boolean> {
  const bucket = await ctx.db
    .query("friendRates")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const next = takeRateToken(bucket, now);
  if (!next.allowed) return false;
  if (bucket) await ctx.db.patch(bucket._id, { tokens: next.tokens, updatedAt: next.updatedAt });
  else await ctx.db.insert("friendRates", { userId, tokens: next.tokens, updatedAt: next.updatedAt });
  return true;
}

type StatsChange = { messages?: number; accepted?: number; ended?: number; blocks?: number; report?: Doc<"userReports">["reason"] };

/** Suma a los contadores del día (`friendDailyStats`), en la fila de esta amistad. */
async function bumpDailyStats(ctx: MutationCtx, friendshipId: Id<"friendships">, now: number, change: StatsChange) {
  const day = hondurasDay(now);
  const shard = statsShard(friendshipId);
  const row = await ctx.db
    .query("friendDailyStats")
    .withIndex("by_day_shard", (q) => q.eq("day", day).eq("shard", shard))
    .unique();
  const add = (current: number | undefined, delta: number | undefined) => (current ?? 0) + (delta ?? 0);
  const reports = { ...row?.reports };
  if (change.report) reports[change.report] = (reports[change.report] ?? 0) + 1;
  const next = {
    messages: add(row?.messages, change.messages),
    accepted: add(row?.accepted, change.accepted),
    ended: add(row?.ended, change.ended),
    blocks: add(row?.blocks, change.blocks),
    reports,
  };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("friendDailyStats", { day, shard, ...next });
}

async function deliver(
  ctx: MutationCtx,
  target: { user: Doc<"users">; row: Doc<"friendships"> },
  message: Pick<Doc<"directMessages">, "kind" | "text" | "verse">,
  now: number,
): Promise<Id<"directMessages">> {
  const { row, user } = target;
  const seq = (row.messageSeq ?? 0) + 1;
  const id = await ctx.db.insert("directMessages", {
    friendshipId: row._id,
    senderId: user._id,
    ...message,
    createdAt: now,
    seq,
  });
  const otherId = otherSide(row, user._id)!;
  const unreadBefore = unreadOf(row, otherId);
  // Lo que uno manda ya lo leyó (y contestar es leer): mi contador queda en
  // cero y el de la otra persona suma uno.
  await ctx.db.patch(row._id, {
    lastMessageAt: now,
    messageSeq: seq,
    lastMessage: { senderId: user._id, kind: message.kind, snippet: previewSnippet(message) },
    [readField(row, user._id)]: now,
    [readSeqField(row, user._id)]: seq,
    [unreadField(row, user._id)]: 0,
    [unreadField(row, otherId)]: unreadOf(row, otherId) + 1,
  });
  await bumpDailyStats(ctx, row._id, now, { messages: 1 });
  if (shouldPushMessage({ unreadBefore, lastMessageAt: row.lastMessageAt, now })) {
    const pushed =
      message.kind === "verse" && message.verse
        ? { kind: "verse" as const, label: verseLabel(message.verse) }
        : { kind: "text" as const, text: message.text ?? "" };
    await queuePush(ctx, otherId, friendMessageNotice(friendDisplayName(user.name), row._id, pushed));
  }
  return id;
}

type VersePayload = NonNullable<Doc<"directMessages">["verse"]>;

/** El versículo (o el rango acotado) con su texto de la Biblia cargada. null si no existe. */
async function loadVerse(ctx: QueryCtx, ref: { book: string; chapter: number; verse: number; verseEnd?: number }): Promise<VersePayload | null> {
  const end = verseRangeEnd(ref);
  if (end === null) return null;
  const rows = await ctx.db
    .query("verses")
    .withIndex("by_ref", (q) =>
      q.eq("version", DEFAULT_BIBLE_VERSION).eq("book", ref.book).eq("chapter", ref.chapter).gte("verse", ref.verse).lte("verse", end),
    )
    .collect();
  if (rows.length === 0 || rows[0]!.verse !== ref.verse) return null;
  const lastVerse = rows[rows.length - 1]!.verse;
  return {
    book: ref.book,
    chapter: ref.chapter,
    verse: ref.verse,
    ...(lastVerse > ref.verse ? { verseEnd: lastVerse } : {}),
    version: DEFAULT_BIBLE_VERSION,
    text: rows.map((row) => row.text.trim()).join(" "),
  };
}

export const sendText = mutation({
  args: { friendshipId: v.id("friendships"), text: v.string() },
  handler: async (ctx, args): Promise<{ status: SendStatus }> => {
    const text = cleanMessageText(args.text);
    if (text.length === 0) return { status: "empty" };
    if (text.length > MESSAGE_MAX_LENGTH) return { status: "too_long" };
    const now = Date.now();
    const target = await sendTarget(ctx, args.friendshipId, now);
    if (target.status !== "ready") return { status: target.status };
    if (!checkMessageContent(text).ok) return { status: "offensive" };
    if (!(await spendRateToken(ctx, target.user._id, now))) return { status: "rate_limited" };
    await deliver(ctx, target, { kind: "text", text }, now);
    return { status: "ok" };
  },
});

/**
 * Mandar un versículo (o hasta `MAX_VERSE_SPAN` seguidos). El teléfono manda
 * solo la cita; el texto sale de la Biblia cargada (regla dura #4).
 */
export const sendVerse = mutation({
  args: {
    friendshipId: v.id("friendships"),
    book: v.string(),
    chapter: v.number(),
    verse: v.number(),
    verseEnd: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ status: SendStatus }> => {
    const verse = await loadVerse(ctx, args);
    if (!verse) return { status: "verse_not_found" };
    const now = Date.now();
    const target = await sendTarget(ctx, args.friendshipId, now);
    if (target.status !== "ready") return { status: target.status };
    if (!(await spendRateToken(ctx, target.user._id, now))) return { status: "rate_limited" };
    await deliver(ctx, target, { kind: "verse", verse }, now);
    return { status: "ok" };
  },
});

/** Lo que se va a mandar, para mostrarlo antes de elegir a quién. */
export const versePreview = query({
  args: { book: v.string(), chapter: v.number(), verse: v.number(), verseEnd: v.optional(v.number()) },
  handler: async (ctx, args) => await loadVerse(ctx, args),
});

/**
 * Con el chat en pantalla: leído hasta `upTo` (el último mensaje que se ve).
 * Si llegó otro después, ese sigue sin leer. Sin `upTo`, todo lo que hay.
 * Compara por el número de cada mensaje (`seq`): dos mensajes del mismo
 * milisegundo no se confunden. Los mensajes de antes, sin número, por fecha.
 */
export const markRead = mutation({
  args: { friendshipId: v.id("friendships"), upTo: v.optional(v.id("directMessages")) },
  handler: async (ctx, args): Promise<null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return null;
    const { row, otherId } = mine;
    if (row.lastMessageAt === undefined) return null;
    const lastSeq = row.messageSeq ?? 0;
    let upTo = { at: row.lastMessageAt, seq: lastSeq };
    if (args.upTo) {
      const seen = await ctx.db.get(args.upTo);
      if (!seen || seen.friendshipId !== row._id) return null;
      upTo = { at: seen.createdAt, seq: seen.seq ?? 0 };
    }
    const atField = readField(row, user._id);
    const seqField = readSeqField(row, user._id);
    const readAt = row[atField] ?? 0;
    const readSeq = row[seqField] ?? 0;
    // Sin mensajes nuevos no se escribe: abrir el chat no despierta las consultas del otro lado.
    const advances = upTo.seq > 0 ? upTo.seq > readSeq : upTo.at > readAt;
    if (!advances) return null;
    let unread = 0;
    if (upTo.seq > 0 ? lastSeq > upTo.seq : row.lastMessageAt > upTo.at) {
      // Llegó algo después de lo que se ve: se cuenta solo eso (pocos, recién llegados).
      const after = await ctx.db
        .query("directMessages")
        .withIndex("by_friendship", (q) => q.eq("friendshipId", row._id).gte("createdAt", upTo.at))
        .take(UNREAD_CAP + 1);
      const isAfter = (message: Doc<"directMessages">) =>
        upTo.seq > 0 && message.seq !== undefined ? message.seq > upTo.seq : message.createdAt > upTo.at;
      unread = after.filter((message) => message.senderId === otherId && isAfter(message)).length;
    }
    await ctx.db.patch(row._id, {
      [atField]: Math.max(readAt, upTo.at),
      ...(upTo.seq > 0 ? { [seqField]: upTo.seq } : {}),
      [unreadField(row, user._id)]: unread,
    });
    return null;
  },
});

// ── Bloquear y reportar ──────────────────────────────────

async function blockPerson(ctx: MutationCtx, me: Id<"users">, otherId: Id<"users">, row: Doc<"friendships">) {
  if (!(await findBlock(ctx, me, otherId))) {
    const now = Date.now();
    await ctx.db.insert("userBlocks", { blockerId: me, blockedId: otherId, createdAt: now });
    await bumpDailyStats(ctx, row._id, now, { blocks: 1 });
  }
  await endFriendship(ctx, row);
}

/**
 * Bloquear: se borra la amistad (o la solicitud) y la conversación, y la otra
 * persona ya no te puede encontrar ni pedirte amistad. No se le avisa.
 */
export const block = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ blocked: boolean }> => {
    const user = await requireUser(ctx);
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return { blocked: false };
    await blockPerson(ctx, user._id, mine.otherId, mine.row);
    return { blocked: true };
  },
});

/** Desbloquear. No vuelven a ser amigos: hay que pedirlo de nuevo. */
export const unblock = mutation({
  args: { blockId: v.id("userBlocks") },
  handler: async (ctx, args): Promise<{ unblocked: boolean }> => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.blockId);
    if (!row || row.blockerId !== user._id) return { unblocked: false };
    await ctx.db.delete(row._id);
    return { unblocked: true };
  },
});

function evidenceText(message: Doc<"directMessages">): string {
  if (message.kind === "verse" && message.verse) return `[${verseLabel(message.verse)}] ${message.verse.text}`;
  return message.text ?? "";
}

/**
 * Reportar a la otra persona, o un mensaje suyo (toque largo), desde una
 * amistad o desde una solicitud que te mandaron (no desde una que mandaste
 * vos). Se guarda una copia de lo reportado para que el fundador lo pueda
 * revisar aunque después se bloquee y la conversación se borre. Con
 * `alsoBlock`, bloquea en el mismo paso.
 */
export const report = mutation({
  args: {
    friendshipId: v.id("friendships"),
    reason: reasonValidator,
    messageId: v.optional(v.id("directMessages")),
    alsoBlock: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ status: "ok" | "not_found" | "too_many" }> => {
    const user = await requireUser(ctx);
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return { status: "not_found" };
    if (mine.row.status === "pending" && mine.row.requestedBy === user._id) return { status: "not_found" };
    const now = Date.now();
    const today = await ctx.db
      .query("userReports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", user._id).gt("createdAt", now - DAY_MS))
      .take(REPORTS_PER_DAY);
    if (today.length >= REPORTS_PER_DAY) return { status: "too_many" };

    let evidence: Doc<"directMessages">[];
    if (args.messageId) {
      const message = await ctx.db.get(args.messageId);
      if (!message || message.friendshipId !== mine.row._id || message.senderId !== mine.otherId) {
        return { status: "not_found" };
      }
      evidence = [message];
    } else {
      const recent = await ctx.db
        .query("directMessages")
        .withIndex("by_friendship", (q) => q.eq("friendshipId", mine.row._id))
        .order("desc")
        .take(REPORT_SCAN);
      evidence = recent.filter((message) => message.senderId === mine.otherId).slice(0, REPORT_EVIDENCE);
    }

    const countsForSuspension = reportCountsForSuspension({
      friendshipAccepted: mine.row.status === "accepted",
      evidenceCount: evidence.length,
      reporterSince: user._creationTime,
      friendsSince: mine.row.acceptedAt ?? mine.row.createdAt,
      now,
    });
    await ctx.db.insert("userReports", {
      reporterId: user._id,
      reportedId: mine.otherId,
      reason: args.reason,
      ...(args.messageId ? { messageId: args.messageId } : {}),
      evidence: evidence.map((message) => ({ text: evidenceText(message), createdAt: message.createdAt })),
      countsForSuspension,
      createdAt: now,
    });
    await bumpDailyStats(ctx, mine.row._id, now, { report: args.reason });
    if (countsForSuspension) await suspendIfWidelyReported(ctx, user._id, mine.otherId, now);
    if (args.alsoBlock) await blockPerson(ctx, user._id, mine.otherId, mine.row);
    return { status: "ok" };
  },
});

/**
 * Anota que este par cuenta (una fila chica por par en `userReportPairs`) y
 * suspende por `AUTO_SUSPEND_DAYS` días a quien junta `AUTO_SUSPEND_REPORTERS`
 * personas distintas. Solo cuentan los reportes de después de la última
 * suspensión automática: al vencer, hacen falta reportes nuevos.
 */
async function suspendIfWidelyReported(ctx: MutationCtx, reporterId: Id<"users">, reportedId: Id<"users">, now: number) {
  const pair = await ctx.db
    .query("userReportPairs")
    .withIndex("by_reported_reporter", (q) => q.eq("reportedId", reportedId).eq("reporterId", reporterId))
    .unique();
  if (pair) await ctx.db.patch(pair._id, { qualifiedAt: now });
  else await ctx.db.insert("userReportPairs", { reportedId, reporterId, qualifiedAt: now });

  const reported = await ctx.db.get(reportedId);
  if (!reported || isFriendsSuspended(reported, now)) return;
  const since = reported.friendsSuspendedUntil ?? 0;
  const reporters = await ctx.db
    .query("userReportPairs")
    .withIndex("by_reported_qualified", (q) => q.eq("reportedId", reportedId).gte("qualifiedAt", since))
    .take(AUTO_SUSPEND_REPORTERS);
  if (reporters.length >= AUTO_SUSPEND_REPORTERS) {
    const until = now + AUTO_SUSPEND_DAYS * DAY_MS;
    await ctx.db.patch(reportedId, { friendsSuspendedUntil: until });
    await ctx.scheduler.runAt(until, internal.friends.expireSuspension, { userId: reportedId });
  }
}

/** Al vencer una suspensión automática: un cambio en la fila para que las pantallas abiertas se enteren. */
export const expireSuspension = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const until = user?.friendsSuspendedUntil;
    if (!user || until === undefined || until > Date.now()) return;
    await ctx.db.patch(user._id, { friendsSuspensionExpiredAt: until });
  },
});

/**
 * Cola de reportes para el fundador (panel de Convex → Functions). Para sacar
 * a alguien de Amigos para siempre: poner `friendsSuspendedAt` en su fila de
 * `users` (la automática, `friendsSuspendedUntil`, vence a los 7 días).
 */
export const recentReports = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userReports")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(Math.max(1, Math.floor(args.limit ?? 50)), 200));
    const now = Date.now();
    return await Promise.all(
      rows.map(async (row) => {
        const reported = await ctx.db.get(row.reportedId);
        return {
          id: row._id,
          createdAt: row.createdAt,
          reason: row.reason,
          reportedUserId: row.reportedId,
          reportedEmail: reported?.email ?? null,
          reportedSuspended: reported ? isFriendsSuspended(reported, now) : false,
          reportedSuspendedUntil: reported ? suspendedUntil(reported, now) : null,
          countsForSuspension: row.countsForSuspension ?? false,
          evidence: row.evidence,
        };
      }),
    );
  },
});

// ── Borrado de cuenta ────────────────────────────────────

export type FriendPurgeCounts = {
  friendships: number;
  directMessages: number;
  userBlocks: number;
  userReports: number;
  userReportPairs: number;
  friendRequestEvents: number;
  friendRates: number;
};

/**
 * Cascada de borrado de cuenta: las amistades y solicitudes con sus
 * conversaciones enteras (también lo que escribió la otra persona en ese
 * chat), los bloqueos en los dos sentidos y los reportes que hizo o que le
 * hicieron (la evidencia es copia de lo que escribió) con sus filas de
 * `userReportPairs`, el historial de
 * solicitudes en los dos sentidos y su límite de ritmo. Gasta a lo sumo
 * `budget` borrados; `done: false` pide otra pasada.
 */
export async function deleteFriendDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: FriendPurgeCounts; done: boolean }> {
  const deleted: FriendPurgeCounts = {
    friendships: 0,
    directMessages: 0,
    userBlocks: 0,
    userReports: 0,
    userReportPairs: 0,
    friendRequestEvents: 0,
    friendRates: 0,
  };
  let spent = 0;

  const nextFriendship = async () =>
    (await ctx.db
      .query("friendships")
      .withIndex("by_userA", (q) => q.eq("userA", userId))
      .first()) ??
    (await ctx.db
      .query("friendships")
      .withIndex("by_userB", (q) => q.eq("userB", userId))
      .first());

  while (spent < budget) {
    const row = await nextFriendship();
    if (!row) break;
    const messages = await ctx.db
      .query("directMessages")
      .withIndex("by_friendship", (q) => q.eq("friendshipId", row._id))
      .take(Math.min(budget - spent, 128));
    if (messages.length === 0) {
      await ctx.db.delete(row._id);
      if (row.status === "accepted") await bumpDailyStats(ctx, row._id, Date.now(), { ended: 1 });
      deleted.friendships += 1;
      spent += 1;
      continue;
    }
    for (const message of messages) await ctx.db.delete(message._id);
    deleted.directMessages += messages.length;
    spent += messages.length;
  }

  type PurgeKey = "userBlocks" | "userReports" | "userReportPairs" | "friendRequestEvents" | "friendRates";
  type PurgeId = Id<"userBlocks"> | Id<"userReports"> | Id<"userReportPairs"> | Id<"friendRequestEvents"> | Id<"friendRates">;
  const pages: Array<{ key: PurgeKey; next: (limit: number) => Promise<{ _id: PurgeId }[]> }> = [
    { key: "userBlocks", next: (limit) => ctx.db.query("userBlocks").withIndex("by_blocker", (q) => q.eq("blockerId", userId)).take(limit) },
    { key: "userBlocks", next: (limit) => ctx.db.query("userBlocks").withIndex("by_blocked", (q) => q.eq("blockedId", userId)).take(limit) },
    { key: "userReports", next: (limit) => ctx.db.query("userReports").withIndex("by_reporter", (q) => q.eq("reporterId", userId)).take(limit) },
    { key: "userReports", next: (limit) => ctx.db.query("userReports").withIndex("by_reported", (q) => q.eq("reportedId", userId)).take(limit) },
    {
      key: "userReportPairs",
      next: (limit) => ctx.db.query("userReportPairs").withIndex("by_reporter", (q) => q.eq("reporterId", userId)).take(limit),
    },
    {
      key: "userReportPairs",
      next: (limit) => ctx.db.query("userReportPairs").withIndex("by_reported_reporter", (q) => q.eq("reportedId", userId)).take(limit),
    },
    {
      key: "friendRequestEvents",
      next: (limit) => ctx.db.query("friendRequestEvents").withIndex("by_requester_created", (q) => q.eq("requesterId", userId)).take(limit),
    },
    { key: "friendRequestEvents", next: (limit) => ctx.db.query("friendRequestEvents").withIndex("by_target", (q) => q.eq("targetId", userId)).take(limit) },
    { key: "friendRates", next: (limit) => ctx.db.query("friendRates").withIndex("by_user", (q) => q.eq("userId", userId)).take(limit) },
  ];
  for (const page of pages) {
    while (spent < budget) {
      const rows = await page.next(Math.min(budget - spent, 128));
      if (rows.length === 0) break;
      for (const row of rows) await ctx.db.delete(row._id);
      deleted[page.key] += rows.length;
      spent += rows.length;
    }
  }

  let done = (await nextFriendship()) === null;
  for (const page of pages) done = done && (await page.next(1)).length === 0;
  return { deleted, done };
}

const REVIEW_FRIEND_CLERK_ID = "review_team_3c";

/**
 * App Review: un amigo de prueba, "3C" (el equipo), con una conversación (un saludo
 * y un versículo) para la cuenta demo, así la revisión puede probar el chat,
 * reportar y bloquear. Nadie puede iniciar sesión como ese amigo. Idempotente.
 */
export const seedReviewFriend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ status: "demo_not_found" | "exists" | "created" }> => {
    const demo = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!demo) return { status: "demo_not_found" };
    const now = Date.now();
    let team = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", REVIEW_FRIEND_CLERK_ID))
      .unique();
    if (!team) {
      const id = await ctx.db.insert("users", {
        clerkId: REVIEW_FRIEND_CLERK_ID,
        name: "3C",
        bibleVersion: DEFAULT_BIBLE_VERSION,
        referralCode: makeReferralCode(REVIEW_FRIEND_CLERK_ID),
        communityRulesAcceptedAt: now,
      });
      team = (await ctx.db.get(id))!;
    }
    if (await findPair(ctx, demo._id, team._id)) return { status: "exists" };

    const friendshipId = await ctx.db.insert("friendships", {
      ...orderedPair(demo._id, team._id),
      requestedBy: team._id,
      status: "accepted",
      createdAt: now,
      acceptedAt: now,
    });
    await bumpDailyStats(ctx, friendshipId, now, { accepted: 1 });
    const target = async () => ({ user: team, row: (await ctx.db.get(friendshipId))! });
    await deliver(
      ctx,
      await target(),
      { kind: "text", text: "¡Hola! Somos el equipo de 3C. Este chat es de prueba: escribí, mandá un versículo desde la Biblia, o usá ••• para reportar o bloquear." },
      now - 60_000,
    );
    const verse = await loadVerse(ctx, { book: "Salmos", chapter: 23, verse: 1 });
    if (verse) await deliver(ctx, await target(), { kind: "verse", verse }, now);
    return { status: "created" };
  },
});
