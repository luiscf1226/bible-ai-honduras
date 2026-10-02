import { ConvexError, v } from "convex/values";

import { internalQuery, mutation } from "./_generated/server";
import { parseReferralCode, REFERRAL_CLAIM_WINDOW_DAYS, type ClaimStatus } from "./referralCode";

/**
 * Atribución de invitaciones (PRD §9b): cada link que se comparte lleva el
 * código de quien lo compartió, y acá se anota en la cuenta de quien llegó.
 * El objetivo es uno solo: saber cuántos registros y cuántos pagos vienen de
 * compartir y cuántos del alcance directo del fundador.
 *
 * - **Primero gana:** una vez anotado, no se cambia.
 * - **Ventana de 30 días** desde que se creó la cuenta: después ya no es
 *   "llegó por una invitación".
 * - **Sin premios:** nadie gana nada por invitar, así que no hay incentivo para
 *   inventar códigos. Tampoco se le avisa ni se le muestra nada a quien invitó.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const claim = mutation({
  args: {
    code: v.string(),
    via: v.union(v.literal("link"), v.literal("play"), v.literal("manual")),
  },
  handler: async (ctx, args): Promise<{ status: ClaimStatus }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("No autenticado");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) {
      throw new ConvexError("Usuario no encontrado — llamá a users.upsert primero");
    }
    if (user.referredBy !== undefined) {
      return { status: "already" };
    }
    const code = parseReferralCode(args.code);
    if (!code) {
      return { status: "invalid" };
    }
    if (code === user.referralCode) {
      return { status: "self" };
    }
    if (Date.now() - user._creationTime > REFERRAL_CLAIM_WINDOW_DAYS * DAY_MS) {
      return { status: "too_late" };
    }
    const inviter = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
      .first();
    if (!inviter) {
      return { status: "not_found" };
    }
    await ctx.db.patch(user._id, { referredBy: code, referredVia: args.via, referredAt: Date.now() });
    return { status: "ok" };
  },
});

/**
 * Lo que responde la pregunta del PRD, desde la terminal:
 *
 *   npx convex run referrals:summary
 *
 * Pro = una fila de `entitlements` con `isPro` y sin vencer. Lee todos los
 * usuarios: alcanza para la beta y el lanzamiento suave.
 */
export const summary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();
    const entitlements = await ctx.db.query("entitlements").collect();
    const proUsers = new Set(
      entitlements
        .filter((row) => row.isPro && (row.expiresAt === undefined || row.expiresAt > now))
        .map((row) => row.userId),
    );
    return summarizeReferrals(
      users.map((user) => ({ referredBy: user.referredBy ?? null, referredVia: user.referredVia ?? null, isPro: proUsers.has(user._id) })),
    );
  },
});

export function summarizeReferrals(
  users: ReadonlyArray<{ referredBy: string | null; referredVia: "link" | "play" | "manual" | null; isPro: boolean }>,
) {
  const byCode = new Map<string, { signups: number; pro: number }>();
  const byVia = { link: 0, play: 0, manual: 0 };
  let referred = 0;
  let referredPro = 0;
  let pro = 0;
  for (const user of users) {
    if (user.isPro) pro += 1;
    if (user.referredBy === null) continue;
    referred += 1;
    if (user.isPro) referredPro += 1;
    if (user.referredVia) byVia[user.referredVia] += 1;
    const entry = byCode.get(user.referredBy) ?? { signups: 0, pro: 0 };
    entry.signups += 1;
    if (user.isPro) entry.pro += 1;
    byCode.set(user.referredBy, entry);
  }
  return {
    users: { total: users.length, referred, direct: users.length - referred },
    pro: { total: pro, referred: referredPro, direct: pro - referredPro },
    byVia,
    topInviters: [...byCode.entries()]
      .map(([code, counts]) => ({ code, ...counts }))
      .sort((a, b) => b.pro - a.pro || b.signups - a.signups)
      .slice(0, 20),
  };
}
