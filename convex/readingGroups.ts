import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { hondurasDateKey } from "./devotional";
import {
  GROUP_MAX_MEMBERS,
  groupDisplayName,
  groupKindLabel,
  type JoinStatus,
  makeInviteToken,
  MAX_GROUPS_PER_USER,
  memberDisplayName,
  nextOwner,
  parseInviteToken,
  sortMembers,
  type MemberProgress,
} from "./readingGroupCore";
import { findReadingPlan, SUPPORTED_READING_PLANS } from "./readingPlanCatalog";
import { ensurePlanStarted, groupProgressFor, type ReadingPlanSummary } from "./readingPlans";

/**
 * Plan en grupo cerrado (#185, cierra #162): hasta 15 personas leyendo el mismo
 * plan. Se entra solo por invitación (link de WhatsApp con token) y lo único
 * que se comparte es el avance del plan. Gratis, como leer: no pasa por
 * `convex/quotas.ts`.
 *
 * Privacidad: un grupo solo lo ve quien es miembro. Sin token no se puede ni
 * saber que existe; con token se ve el nombre, el plan y cuántas personas hay,
 * nunca quiénes son hasta entrar.
 */

// Misma lista que `GROUP_KINDS`; `readingGroups.test.ts` verifica que coincidan.
const kindValidator = v.union(
  v.literal("familia"),
  v.literal("celula"),
  v.literal("escuela-dominical"),
  v.literal("jovenes"),
  v.literal("amigos"),
);

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

async function membersOf(ctx: QueryCtx, groupId: Id<"readingGroups">) {
  return await ctx.db
    .query("readingGroupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .take(GROUP_MAX_MEMBERS + 1);
}

async function membershipsOf(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("readingGroupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_GROUPS_PER_USER + 1);
}

async function findMembership(ctx: QueryCtx, groupId: Id<"readingGroups">, userId: Id<"users">) {
  return await ctx.db
    .query("readingGroupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

async function groupByToken(ctx: QueryCtx, raw: string) {
  const token = parseInviteToken(raw);
  if (!token) return null;
  return await ctx.db
    .query("readingGroups")
    .withIndex("by_invite_token", (q) => q.eq("inviteToken", token))
    .unique();
}

function newToken(): string {
  return makeInviteToken((length) => crypto.getRandomValues(new Uint8Array(length)));
}

function planName(planId: string): string {
  return findReadingPlan(planId)?.name ?? "Plan de lectura";
}

/** Planes que se pueden leer en grupo: los mismos del catálogo, sin sesión. */
export const planChoices = query({
  args: {},
  handler: async (): Promise<ReadingPlanSummary[]> =>
    SUPPORTED_READING_PLANS.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      totalDays: plan.totalDays,
    })),
});

export type MyGroupSummary = {
  id: Id<"readingGroups">;
  name: string;
  planId: string;
  memberCount: number;
};

/** Mis grupos, del más nuevo al más viejo. Vacío sin sesión. */
export const mine = query({
  args: {},
  handler: async (ctx): Promise<MyGroupSummary[]> => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const memberships = await membershipsOf(ctx, user._id);
    const groups: MyGroupSummary[] = [];
    for (const membership of [...memberships].sort((a, b) => b.joinedAt - a.joinedAt)) {
      const group = await ctx.db.get(membership.groupId);
      if (!group) continue;
      groups.push({
        id: group._id,
        name: groupDisplayName(group.kind, planName(group.planId)),
        planId: group.planId,
        memberCount: (await membersOf(ctx, group._id)).length,
      });
    }
    return groups;
  },
});

export type GroupDetail = {
  id: Id<"readingGroups">;
  name: string;
  kindLabel: string;
  plan: ReadingPlanSummary;
  isOwner: boolean;
  inviteToken: string;
  maxMembers: number;
  members: MemberProgress[];
};

/** Un grupo con el avance de cada miembro. null si no sos miembro o no existe. */
export const detail = query({
  args: { groupId: v.id("readingGroups") },
  handler: async (ctx, args): Promise<GroupDetail | null> => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const group = await ctx.db.get(args.groupId);
    if (!group || !(await findMembership(ctx, group._id, user._id))) return null;
    const plan = findReadingPlan(group.planId);
    if (!plan) return null;

    const today = hondurasDateKey();
    const members: MemberProgress[] = [];
    for (const membership of await membersOf(ctx, group._id)) {
      const member = await ctx.db.get(membership.userId);
      if (!member) continue;
      const progress = await groupProgressFor(ctx, member._id, plan, today);
      members.push({
        name: memberDisplayName(member.name),
        isMe: member._id === user._id,
        completedCount: progress?.completedCount ?? null,
        todayCompleted: progress?.todayCompleted ?? false,
        totalDays: plan.totalDays,
      });
    }

    return {
      id: group._id,
      name: groupDisplayName(group.kind, plan.name),
      kindLabel: groupKindLabel(group.kind),
      plan: { id: plan.id, name: plan.name, description: plan.description, totalDays: plan.totalDays },
      isOwner: group.ownerId === user._id,
      inviteToken: group.inviteToken,
      maxMembers: GROUP_MAX_MEMBERS,
      members: sortMembers(members),
    };
  },
});

export type InvitePreview =
  | { status: "not_found" }
  | {
      status: "ok";
      groupId: Id<"readingGroups">;
      name: string;
      planName: string;
      planTotalDays: number;
      memberCount: number;
      maxMembers: number;
      alreadyMember: boolean;
    };

/**
 * Lo que se ve antes de aceptar una invitación: nombre, plan y cuántas
 * personas hay. Nunca quiénes son. Funciona sin sesión (la pantalla pide
 * iniciarla para unirse).
 */
export const previewInvite = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<InvitePreview> => {
    const group = await groupByToken(ctx, args.token);
    if (!group) return { status: "not_found" };
    const plan = findReadingPlan(group.planId);
    if (!plan) return { status: "not_found" };
    const user = await currentUser(ctx);
    const members = await membersOf(ctx, group._id);
    return {
      status: "ok",
      groupId: group._id,
      name: groupDisplayName(group.kind, plan.name),
      planName: plan.name,
      planTotalDays: plan.totalDays,
      memberCount: members.length,
      maxMembers: GROUP_MAX_MEMBERS,
      alreadyMember: user ? members.some((member) => member.userId === user._id) : false,
    };
  },
});

/**
 * Crea un grupo con un plan del catálogo y un tipo de la lista fija. Quien lo
 * crea queda adentro y, si no venía leyendo ese plan, lo empieza hoy.
 */
export const create = mutation({
  args: { planId: v.string(), kind: kindValidator },
  handler: async (ctx, args): Promise<{ status: "ok"; groupId: Id<"readingGroups"> } | { status: "too_many_groups" }> => {
    const user = await requireUser(ctx);
    if (!findReadingPlan(args.planId)) {
      throw new ConvexError(`Plan desconocido: ${args.planId}`);
    }
    if ((await membershipsOf(ctx, user._id)).length >= MAX_GROUPS_PER_USER) {
      return { status: "too_many_groups" };
    }
    const now = Date.now();
    const groupId = await ctx.db.insert("readingGroups", {
      planId: args.planId,
      kind: args.kind,
      ownerId: user._id,
      inviteToken: newToken(),
      createdAt: now,
    });
    await ctx.db.insert("readingGroupMembers", { groupId, userId: user._id, joinedAt: now });
    await ensurePlanStarted(ctx, user._id, args.planId);
    return { status: "ok", groupId };
  },
});

/**
 * Entrar con el token del link. Si ya venías leyendo el plan, tu avance se
 * queda como está; si no, lo empezás hoy.
 */
export const join = mutation({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ status: JoinStatus; groupId?: Id<"readingGroups"> }> => {
    const user = await requireUser(ctx);
    const group = await groupByToken(ctx, args.token);
    if (!group || !findReadingPlan(group.planId)) return { status: "not_found" };
    if (await findMembership(ctx, group._id, user._id)) {
      return { status: "already", groupId: group._id };
    }
    if ((await membersOf(ctx, group._id)).length >= GROUP_MAX_MEMBERS) return { status: "full" };
    if ((await membershipsOf(ctx, user._id)).length >= MAX_GROUPS_PER_USER) return { status: "too_many_groups" };

    await ctx.db.insert("readingGroupMembers", { groupId: group._id, userId: user._id, joinedAt: Date.now() });
    await ensurePlanStarted(ctx, user._id, group.planId);
    return { status: "ok", groupId: group._id };
  },
});

/**
 * Saca a una persona de un grupo. Si era quien lo creó, queda a cargo quien
 * entró primero; si no queda nadie, el grupo (y su token) se borra. El avance
 * del plan es de la persona y no se toca: sigue leyendo sola.
 */
async function removeMembership(ctx: MutationCtx, membership: Doc<"readingGroupMembers">): Promise<void> {
  await ctx.db.delete(membership._id);
  const group = await ctx.db.get(membership.groupId);
  if (!group) return;
  const remaining = await membersOf(ctx, group._id);
  const heir = nextOwner(remaining);
  if (!heir) {
    await ctx.db.delete(group._id);
    return;
  }
  if (group.ownerId === membership.userId) {
    await ctx.db.patch(group._id, { ownerId: heir.userId });
  }
}

export const leave = mutation({
  args: { groupId: v.id("readingGroups") },
  handler: async (ctx, args): Promise<{ left: boolean }> => {
    const user = await requireUser(ctx);
    const membership = await findMembership(ctx, args.groupId, user._id);
    if (!membership) return { left: false };
    await removeMembership(ctx, membership);
    return { left: true };
  },
});

/**
 * Link nuevo: el anterior deja de servir. Solo quien está a cargo, para cuando
 * el link se reenvió a quien no debía. Quien ya entró sigue adentro.
 */
export const rotateInvite = mutation({
  args: { groupId: v.id("readingGroups") },
  handler: async (ctx, args): Promise<{ inviteToken: string }> => {
    const user = await requireUser(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group || group.ownerId !== user._id) {
      throw new ConvexError("Solo quien está a cargo del grupo puede cambiar el link");
    }
    const inviteToken = newToken();
    await ctx.db.patch(group._id, { inviteToken });
    return { inviteToken };
  },
});

/**
 * Cascada de borrado de cuenta (#107): sale de cada grupo con la misma regla
 * que "Salir del grupo" (pasa el grupo a otra persona o lo borra si queda
 * vacío). Acotado por `MAX_GROUPS_PER_USER`, entra en una sola pasada.
 */
export async function deleteReadingGroupDataForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ deleted: number }> {
  const memberships = await ctx.db
    .query("readingGroupMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const membership of memberships) {
    await removeMembership(ctx, membership);
  }
  return { deleted: memberships.length };
}
