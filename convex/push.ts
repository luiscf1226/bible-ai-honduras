import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import {
  chunk,
  EXPO_PUSH_URL,
  EXPO_RECEIPTS_URL,
  type ExpoTicket,
  isDeadDevice,
  isExpoPushToken,
  MAX_TOKENS_PER_USER,
  type PushNotice,
  RECEIPTS_BATCH,
  RECEIPTS_DELAY_MS,
  SEND_BATCH,
} from "./pushCore";

/**
 * Avisos push por Expo (1.0.4). La app registra el token de su teléfono al
 * entrar; el servidor manda los avisos cuando pasa algo (`queuePush`). Qué
 * dice cada aviso y a dónde lleva lo decide `pushCore.ts`, no la app.
 */

const platformValidator = v.union(v.literal("ios"), v.literal("android"));

const noticeValidator = v.object({
  title: v.string(),
  body: v.string(),
  data: v.object({ kind: v.string(), url: v.string() }),
  channelId: v.optional(v.string()),
});

async function currentUserId(ctx: MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

/**
 * Este teléfono avisa a la cuenta con sesión. Si el token era de otra cuenta
 * (cambiaron de cuenta en el mismo teléfono), pasa a esta.
 */
export const register = mutation({
  args: { token: v.string(), platform: platformValidator },
  handler: async (ctx, args): Promise<{ registered: boolean }> => {
    const userId = await currentUserId(ctx);
    if (!userId) throw new ConvexError("No autenticado");
    if (!isExpoPushToken(args.token)) return { registered: false };
    const now = Date.now();
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { userId, platform: args.platform, updatedAt: now });
    } else {
      await ctx.db.insert("pushTokens", { userId, token: args.token, platform: args.platform, updatedAt: now });
    }
    const mine = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_TOKENS_PER_USER + 5);
    for (const stale of mine.slice(MAX_TOKENS_PER_USER)) await ctx.db.delete(stale._id);
    return { registered: true };
  },
});

/**
 * Al cerrar sesión: este teléfono deja de recibir avisos. No pide sesión:
 * tener el token es tener el teléfono, y así se puede soltar después de
 * cerrar sesión sin red (el teléfono reintenta ya sin sesión).
 */
export const unregister = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<null> => {
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .take(5);
    for (const row of rows) await ctx.db.delete(row._id);
    return null;
  },
});

/** Manda el aviso a todos los teléfonos de la cuenta, después de guardar la mutación. */
export async function queuePush(ctx: MutationCtx, userId: Id<"users">, notice: PushNotice): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.push.send, { userId, notice });
}

/** Borra los tokens de una cuenta que se elimina (`users.purgeAccountData`). */
export async function deletePushTokensForUser(ctx: MutationCtx, userId: Id<"users">, budget: number) {
  const rows = await ctx.db
    .query("pushTokens")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(budget + 1);
  const page = rows.slice(0, budget);
  for (const row of page) await ctx.db.delete(row._id);
  return { deleted: page.length, done: rows.length <= budget };
}

export const tokensFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string[]> => {
    const rows = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_TOKENS_PER_USER);
    return rows.map((row) => row.token);
  },
});

export const forgetTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, args): Promise<null> => {
    for (const token of args.tokens) {
      const rows = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .take(5);
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return null;
  },
});

async function postExpo(url: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  // Opcional: con "Enhanced Security for Push" en Expo, solo el servidor puede mandar.
  if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Expo push respondió ${response.status}: ${await response.text()}`);
  return ((await response.json()) as { data?: unknown }).data;
}

export const send = internalAction({
  args: { userId: v.id("users"), notice: noticeValidator },
  handler: async (ctx, args): Promise<{ sent: number }> => {
    const tokens: string[] = await ctx.runQuery(internal.push.tokensFor, { userId: args.userId });
    if (tokens.length === 0) return { sent: 0 };
    const { title, body, data, channelId } = args.notice;
    const dead: string[] = [];
    const pending: { id: string; token: string }[] = [];
    for (const batch of chunk(tokens, SEND_BATCH)) {
      const messages = batch.map((to) => ({
        to,
        title,
        body,
        data,
        sound: "default",
        priority: "high",
        ...(channelId ? { channelId } : {}),
      }));
      const tickets = (await postExpo(EXPO_PUSH_URL, messages)) as ExpoTicket[];
      tickets.forEach((ticket, index) => {
        const token = batch[index]!;
        if (ticket.status === "ok") pending.push({ id: ticket.id, token });
        else if (isDeadDevice(ticket)) dead.push(token);
        else console.error(`Aviso push rechazado (${args.notice.data.kind}): ${ticket.message ?? "sin detalle"}`);
      });
    }
    if (dead.length > 0) await ctx.runMutation(internal.push.forgetTokens, { tokens: dead });
    if (pending.length > 0) await ctx.scheduler.runAfter(RECEIPTS_DELAY_MS, internal.push.checkReceipts, { tickets: pending });
    return { sent: pending.length };
  },
});

/** Apple y Google confirman después: un teléfono que ya no existe se olvida acá. */
export const checkReceipts = internalAction({
  args: { tickets: v.array(v.object({ id: v.string(), token: v.string() })) },
  handler: async (ctx, args): Promise<null> => {
    const dead: string[] = [];
    for (const batch of chunk(args.tickets, RECEIPTS_BATCH)) {
      const receipts = (await postExpo(EXPO_RECEIPTS_URL, { ids: batch.map((ticket) => ticket.id) })) as Record<
        string,
        { status: string; message?: string; details?: { error?: string } }
      >;
      for (const ticket of batch) {
        const receipt = receipts?.[ticket.id];
        if (!receipt || receipt.status === "ok") continue;
        if (isDeadDevice(receipt)) dead.push(ticket.token);
        else console.error(`Recibo push con error: ${receipt.message ?? receipt.details?.error ?? "sin detalle"}`);
      }
    }
    if (dead.length > 0) await ctx.runMutation(internal.push.forgetTokens, { tokens: dead });
    return null;
  },
});
