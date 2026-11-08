import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { DEFAULT_BIBLE_VERSION } from "./bibleVersions";
import { checkMessageContent } from "./chatFilter";
import {
  cleanMessageText,
  friendDisplayName,
  friendInitial,
  MAX_CONNECTIONS,
  MESSAGE_MAX_LENGTH,
  MESSAGES_PER_MINUTE,
  messagePreview,
  orderedPair,
  otherSide,
  parseFriendCode,
  RATE_WINDOW_MS,
  readField,
  REPORT_EVIDENCE,
  REPORTS_PER_DAY,
  type RequestStatus,
  type SendStatus,
  THREAD_LIMIT,
  UNREAD_CAP,
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
 *   límite de ritmo.
 * - Reportar (con copia de lo reportado) y bloquear. Bloquear borra la
 *   amistad y su conversación, y la otra persona ya no te encuentra.
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
function socialGate(user: Doc<"users">): "suspended" | "rules_required" | null {
  if (user.friendsSuspendedAt !== undefined) return "suspended";
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

async function unreadCount(ctx: QueryCtx, row: Doc<"friendships">, me: Id<"users">): Promise<number> {
  const readAt = row[readField(row, me)] ?? 0;
  if (row.lastMessageAt === undefined || row.lastMessageAt <= readAt) return 0;
  const unread = await ctx.db
    .query("directMessages")
    .withIndex("by_friendship", (q) => q.eq("friendshipId", row._id).gt("createdAt", readAt))
    .take(UNREAD_CAP + 1);
  return unread.filter((message) => message.senderId !== me).length;
}

async function personCard(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const name = friendDisplayName(user?.name);
  return { name, initial: friendInitial(name) };
}

// ── Consultas ────────────────────────────────────────────

export type FriendsSummary = { friends: number; requests: number; unread: number };

/** Contadores para Inicio y Mi espacio. Ceros sin sesión. */
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
      unread += await unreadCount(ctx, row, user._id);
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
  requests: PendingRow[];
  sent: PendingRow[];
  friends: FriendRow[];
};

/** La pantalla de Amigos: solicitudes, amigos con su último mensaje y tu código. null sin sesión. */
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
      const last = await ctx.db
        .query("directMessages")
        .withIndex("by_friendship", (q) => q.eq("friendshipId", row._id))
        .order("desc")
        .first();
      friends.push({
        friendshipId: row._id,
        ...card,
        preview: messagePreview(
          last ? { kind: last.kind, text: last.text, verse: last.verse, fromMe: last.senderId === user._id } : null,
        ),
        lastMessageAt: last?.createdAt ?? null,
        unread: await unreadCount(ctx, row, user._id),
        sortAt: last?.createdAt ?? row.acceptedAt ?? row.createdAt,
      });
    }

    requests.sort((a, b) => b.createdAt - a.createdAt);
    sent.sort((a, b) => b.createdAt - a.createdAt);
    friends.sort((a, b) => b.sortAt - a.sortAt);
    return {
      code: user.referralCode,
      rulesAccepted: user.communityRulesAcceptedAt !== undefined,
      suspended: user.friendsSuspendedAt !== undefined,
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
  messages: ThreadMessage[];
};

/** Un chat, con los últimos `THREAD_LIMIT` mensajes en orden. null si no sos parte. */
export const thread = query({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<Thread | null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return null;
    const { row, otherId } = mine;
    const recent = await ctx.db
      .query("directMessages")
      .withIndex("by_friendship", (q) => q.eq("friendshipId", row._id))
      .order("desc")
      .take(THREAD_LIMIT);
    const gate = socialGate(user);
    return {
      friendshipId: row._id,
      status: row.status,
      requestedByMe: row.requestedBy === user._id,
      friend: await personCard(ctx, otherId),
      friendReadAt: row[readField(row, otherId)] ?? null,
      canWrite: row.status === "accepted" && gate === null,
      gate,
      messages: recent.reverse().map((message) => ({
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
 * Pedir amistad con un código. Si la otra persona ya te la había pedido, se
 * aceptan las dos de una vez. A quien te bloqueó (o bloqueaste) se le responde
 * igual que a un código que no existe: no se le avisa que hay un bloqueo.
 */
export const request = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<{ status: RequestStatus; friendshipId?: Id<"friendships"> }> => {
    const user = await requireUser(ctx);
    const gate = socialGate(user);
    if (gate) return { status: gate };
    const other = await userByCode(ctx, args.code);
    if (!other) return { status: "not_found" };
    if (other._id === user._id) return { status: "self" };
    if (await blockedEitherWay(ctx, user._id, other._id)) return { status: "not_found" };

    const existing = await findPair(ctx, user._id, other._id);
    if (existing) {
      if (existing.status === "accepted") return { status: "already_friends", friendshipId: existing._id };
      if (existing.requestedBy === user._id) return { status: "already_sent", friendshipId: existing._id };
      await ctx.db.patch(existing._id, { status: "accepted", acceptedAt: Date.now() });
      return { status: "accepted", friendshipId: existing._id };
    }

    if (
      (await connectionsOf(ctx, user._id)).length >= MAX_CONNECTIONS ||
      (await connectionsOf(ctx, other._id)).length >= MAX_CONNECTIONS
    ) {
      return { status: "too_many" };
    }
    const friendshipId = await ctx.db.insert("friendships", {
      ...orderedPair(user._id, other._id),
      requestedBy: user._id,
      status: "pending",
      createdAt: Date.now(),
    });
    return { status: "sent", friendshipId };
  },
});

/** Aceptar una solicitud que te mandaron. */
export const accept = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ status: "ok" | "not_found" | "suspended" | "rules_required" }> => {
    const user = await requireUser(ctx);
    const gate = socialGate(user);
    if (gate) return { status: gate };
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine || mine.row.status !== "pending" || mine.row.requestedBy === user._id) return { status: "not_found" };
    await ctx.db.patch(mine.row._id, { status: "accepted", acceptedAt: Date.now() });
    return { status: "ok" };
  },
});

/** Borra la amistad y, en segundo plano, toda su conversación. */
async function endFriendship(ctx: MutationCtx, row: Doc<"friendships">): Promise<void> {
  await ctx.db.delete(row._id);
  if (row.lastMessageAt !== undefined) {
    await ctx.scheduler.runAfter(0, internal.friends.purgeConversation, { friendshipId: row._id });
  }
}

/**
 * Rechazar una solicitud, cancelar la que mandaste o dejar de ser amigos. La
 * conversación se borra para los dos.
 */
export const remove = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<{ removed: boolean }> => {
    const user = await requireUser(ctx);
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return { removed: false };
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
  const gate = socialGate(user);
  if (gate) return { status: gate };
  const mine = await myFriendship(ctx, friendshipId, user._id);
  if (!mine || mine.row.status !== "accepted") return { status: "not_friends" };
  const lastMinute = await ctx.db
    .query("directMessages")
    .withIndex("by_sender", (q) => q.eq("senderId", user._id).gt("createdAt", now - RATE_WINDOW_MS))
    .take(MESSAGES_PER_MINUTE);
  if (lastMinute.length >= MESSAGES_PER_MINUTE) return { status: "rate_limited" };
  return { status: "ready", user, row: mine.row };
}

async function deliver(
  ctx: MutationCtx,
  target: { user: Doc<"users">; row: Doc<"friendships"> },
  message: Pick<Doc<"directMessages">, "kind" | "text" | "verse">,
  now: number,
): Promise<Id<"directMessages">> {
  const id = await ctx.db.insert("directMessages", {
    friendshipId: target.row._id,
    senderId: target.user._id,
    ...message,
    createdAt: now,
  });
  // Lo que uno manda ya lo leyó: así el contador cuenta solo lo de la otra persona.
  await ctx.db.patch(target.row._id, { lastMessageAt: now, [readField(target.row, target.user._id)]: now });
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
    await deliver(ctx, target, { kind: "verse", verse }, now);
    return { status: "ok" };
  },
});

/** Lo que se va a mandar, para mostrarlo antes de elegir a quién. */
export const versePreview = query({
  args: { book: v.string(), chapter: v.number(), verse: v.number(), verseEnd: v.optional(v.number()) },
  handler: async (ctx, args) => await loadVerse(ctx, args),
});

/** Al abrir el chat: todo lo que hay quedó leído. */
export const markRead = mutation({
  args: { friendshipId: v.id("friendships") },
  handler: async (ctx, args): Promise<null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const mine = await myFriendship(ctx, args.friendshipId, user._id);
    if (!mine) return null;
    const field = readField(mine.row, user._id);
    const readAt = mine.row[field] ?? 0;
    // Sin mensajes nuevos no se escribe: abrir el chat no despierta las consultas del otro lado.
    if (mine.row.lastMessageAt !== undefined && mine.row.lastMessageAt > readAt) {
      await ctx.db.patch(mine.row._id, { [field]: Date.now() });
    }
    return null;
  },
});

// ── Bloquear y reportar ──────────────────────────────────

async function blockPerson(ctx: MutationCtx, me: Id<"users">, otherId: Id<"users">, row: Doc<"friendships">) {
  if (!(await findBlock(ctx, me, otherId))) {
    await ctx.db.insert("userBlocks", { blockerId: me, blockedId: otherId, createdAt: Date.now() });
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
 * Reportar a la otra persona, o un mensaje suyo (toque largo). Se guarda una
 * copia de lo reportado para que el fundador lo pueda revisar aunque después
 * se bloquee y la conversación se borre. Con `alsoBlock`, bloquea en el mismo
 * paso.
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
        .take(THREAD_LIMIT);
      evidence = recent.filter((message) => message.senderId === mine.otherId).slice(0, REPORT_EVIDENCE);
    }

    await ctx.db.insert("userReports", {
      reporterId: user._id,
      reportedId: mine.otherId,
      reason: args.reason,
      ...(args.messageId ? { messageId: args.messageId } : {}),
      evidence: evidence.map((message) => ({ text: evidenceText(message), createdAt: message.createdAt })),
      createdAt: now,
    });
    if (args.alsoBlock) await blockPerson(ctx, user._id, mine.otherId, mine.row);
    return { status: "ok" };
  },
});

/**
 * Cola de reportes para el fundador (panel de Convex → Functions). Para sacar
 * a alguien de Amigos: poner `friendsSuspendedAt` en su fila de `users`.
 */
export const recentReports = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userReports")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(Math.max(1, Math.floor(args.limit ?? 50)), 200));
    return await Promise.all(
      rows.map(async (row) => {
        const reported = await ctx.db.get(row.reportedId);
        return {
          id: row._id,
          createdAt: row.createdAt,
          reason: row.reason,
          reportedUserId: row.reportedId,
          reportedEmail: reported?.email ?? null,
          reportedSuspended: reported?.friendsSuspendedAt !== undefined,
          evidence: row.evidence,
        };
      }),
    );
  },
});

// ── Borrado de cuenta ────────────────────────────────────

export type FriendPurgeCounts = { friendships: number; directMessages: number; userBlocks: number; userReports: number };

/**
 * Cascada de borrado de cuenta: las amistades y solicitudes con sus
 * conversaciones enteras (también lo que escribió la otra persona en ese
 * chat), los bloqueos en los dos sentidos y los reportes que hizo o que le
 * hicieron (la evidencia es copia de lo que escribió). Gasta a lo sumo
 * `budget` borrados; `done: false` pide otra pasada.
 */
export async function deleteFriendDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  budget: number,
): Promise<{ deleted: FriendPurgeCounts; done: boolean }> {
  const deleted: FriendPurgeCounts = { friendships: 0, directMessages: 0, userBlocks: 0, userReports: 0 };
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
      deleted.friendships += 1;
      spent += 1;
      continue;
    }
    for (const message of messages) await ctx.db.delete(message._id);
    deleted.directMessages += messages.length;
    spent += messages.length;
  }

  const pages: Array<{ key: "userBlocks" | "userReports"; next: (limit: number) => Promise<{ _id: Id<"userBlocks"> | Id<"userReports"> }[]> }> = [
    { key: "userBlocks", next: (limit) => ctx.db.query("userBlocks").withIndex("by_blocker", (q) => q.eq("blockerId", userId)).take(limit) },
    { key: "userBlocks", next: (limit) => ctx.db.query("userBlocks").withIndex("by_blocked", (q) => q.eq("blockedId", userId)).take(limit) },
    { key: "userReports", next: (limit) => ctx.db.query("userReports").withIndex("by_reporter", (q) => q.eq("reporterId", userId)).take(limit) },
    { key: "userReports", next: (limit) => ctx.db.query("userReports").withIndex("by_reported", (q) => q.eq("reportedId", userId)).take(limit) },
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
