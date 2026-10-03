import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { GROUP_KINDS, GROUP_MAX_MEMBERS, MAX_GROUPS_PER_USER } from "./readingGroupCore";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./devotional.ts": () => import("./devotional"),
  "./readingPlanCatalog.ts": () => import("./readingPlanCatalog"),
  "./readingPlans.ts": () => import("./readingPlans"),
  "./readingGroups.ts": () => import("./readingGroups"),
  "./users.ts": () => import("./users"),
  "./history.ts": () => import("./history"),
  "./reading.ts": () => import("./reading"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string, name?: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev", ...(name ? { name } : {}) });
}

async function signUp(t: ReturnType<typeof convexTest>, clerkId: string, name?: string) {
  const user = asUser(t, clerkId, name);
  await user.mutation(api.users.upsert, {});
  return user;
}

type Client = Awaited<ReturnType<typeof signUp>>;

async function createGroup(user: Client, planId = "ansiedad") {
  const created = await user.mutation(api.readingGroups.create, { planId, kind: "celula" });
  if (created.status !== "ok") throw new Error("no se creó el grupo");
  const detail = await user.query(api.readingGroups.detail, { groupId: created.groupId });
  return { groupId: created.groupId, token: detail!.inviteToken };
}

describe("readingGroups", () => {
  it("el validador de tipos coincide con la lista fija", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    for (const kind of GROUP_KINDS) {
      const result = await ana.mutation(api.readingGroups.create, { planId: "duelo", kind: kind.id });
      expect(result.status).toBe("ok");
    }
  });

  it("crear deja a quien lo crea adentro, con el plan empezado y un nombre derivado", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana López");
    const { groupId, token } = await createGroup(ana);

    const detail = await ana.query(api.readingGroups.detail, { groupId });
    expect(detail).toMatchObject({ name: "Célula · Ansiedad", isOwner: true, maxMembers: GROUP_MAX_MEMBERS });
    expect(detail?.members).toEqual([{ name: "Ana", isMe: true, completedCount: 0, todayCompleted: false, totalDays: 7 }]);
    expect(token).toMatch(/^[0-9A-Za-z]{16}$/);
    expect(await ana.query(api.readingPlans.myProgress, { planId: "ansiedad" })).not.toBeNull();
    expect(await ana.query(api.readingGroups.mine, {})).toEqual([
      { id: groupId, name: "Célula · Ansiedad", planId: "ansiedad", memberCount: 1 },
    ]);
  });

  it("rechaza un plan que no existe", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    await expect(ana.mutation(api.readingGroups.create, { planId: "inventado", kind: "familia" })).rejects.toThrow("Plan desconocido");
  });

  it("unirse con el token: no reinicia el avance que ya traías", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const { groupId, token } = await createGroup(ana);

    await beto.mutation(api.readingPlans.start, { planId: "ansiedad" });
    await beto.mutation(api.readingPlans.markDayRead, { planId: "ansiedad", day: 1 });

    const preview = await beto.query(api.readingGroups.previewInvite, { token });
    expect(preview).toMatchObject({ status: "ok", name: "Célula · Ansiedad", memberCount: 1, alreadyMember: false });
    expect(JSON.stringify(preview)).not.toContain("Ana");

    await expect(beto.mutation(api.readingGroups.join, { token })).resolves.toEqual({ status: "ok", groupId });
    await expect(beto.mutation(api.readingGroups.join, { token })).resolves.toEqual({ status: "already", groupId });

    const detail = await ana.query(api.readingGroups.detail, { groupId });
    expect(detail?.members.map((m) => [m.name, m.completedCount, m.todayCompleted])).toEqual([
      ["Ana", 0, false],
      ["Beto", 1, true],
    ]);
  });

  it("solo lo ve quien es miembro; con un token falso no hay nada", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const intruso = await signUp(t, "user_intruso", "Intruso");
    const { groupId } = await createGroup(ana);

    expect(await intruso.query(api.readingGroups.detail, { groupId })).toBeNull();
    expect(await intruso.query(api.readingGroups.previewInvite, { token: "abcdefghijkmnpqr" })).toEqual({ status: "not_found" });
    expect(await intruso.query(api.readingGroups.previewInvite, { token: "<script>" })).toEqual({ status: "not_found" });
    await expect(intruso.mutation(api.readingGroups.join, { token: "abcdefghijkmnpqr" })).resolves.toEqual({ status: "not_found" });
    expect(await t.query(api.readingGroups.detail, { groupId })).toBeNull();
  });

  it("no pasa de 15 personas", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const { token } = await createGroup(ana);
    for (let i = 1; i < GROUP_MAX_MEMBERS; i += 1) {
      const member = await signUp(t, `user_${i}`, `Persona${i}`);
      expect((await member.mutation(api.readingGroups.join, { token })).status).toBe("ok");
    }
    const late = await signUp(t, "user_tarde", "Tarde");
    await expect(late.mutation(api.readingGroups.join, { token })).resolves.toEqual({ status: "full" });
  });

  it("una persona no está en más de 5 grupos", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    for (let i = 0; i < MAX_GROUPS_PER_USER; i += 1) {
      await createGroup(beto, "duelo");
    }
    await expect(beto.mutation(api.readingGroups.create, { planId: "duelo", kind: "amigos" })).resolves.toEqual({
      status: "too_many_groups",
    });
    const { token } = await createGroup(ana);
    await expect(beto.mutation(api.readingGroups.join, { token })).resolves.toEqual({ status: "too_many_groups" });
  });

  it("salir: el grupo pasa a quien entró primero y el último se lleva el grupo", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const carla = await signUp(t, "user_carla", "Carla");
    const { groupId, token } = await createGroup(ana);
    await beto.mutation(api.readingGroups.join, { token });
    await carla.mutation(api.readingGroups.join, { token });

    await expect(ana.mutation(api.readingGroups.leave, { groupId })).resolves.toEqual({ left: true });
    expect(await ana.query(api.readingGroups.detail, { groupId })).toBeNull();
    expect(await ana.query(api.readingGroups.mine, {})).toEqual([]);
    // El avance del plan es de Ana: sigue leyendo sola.
    expect(await ana.query(api.readingPlans.myProgress, { planId: "ansiedad" })).not.toBeNull();
    expect((await beto.query(api.readingGroups.detail, { groupId }))?.isOwner).toBe(true);
    expect((await carla.query(api.readingGroups.detail, { groupId }))?.isOwner).toBe(false);

    await beto.mutation(api.readingGroups.leave, { groupId });
    await carla.mutation(api.readingGroups.leave, { groupId });
    const rows = await t.run(async (ctx) => ({
      groups: await ctx.db.query("readingGroups").collect(),
      members: await ctx.db.query("readingGroupMembers").collect(),
    }));
    expect(rows).toEqual({ groups: [], members: [] });
    await expect(ana.mutation(api.readingGroups.leave, { groupId })).resolves.toEqual({ left: false });
  });

  it("cambiar el link: solo quien está a cargo, y el viejo deja de servir", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const carla = await signUp(t, "user_carla", "Carla");
    const { groupId, token } = await createGroup(ana);
    await beto.mutation(api.readingGroups.join, { token });

    await expect(beto.mutation(api.readingGroups.rotateInvite, { groupId })).rejects.toThrow("Solo quien está a cargo");
    const { inviteToken } = await ana.mutation(api.readingGroups.rotateInvite, { groupId });
    expect(inviteToken).not.toBe(token);
    await expect(carla.mutation(api.readingGroups.join, { token })).resolves.toEqual({ status: "not_found" });
    await expect(carla.mutation(api.readingGroups.join, { token: inviteToken })).resolves.toEqual({ status: "ok", groupId });
  });

  it("los planes para elegir son los del catálogo, sin sesión", async () => {
    const t = convexTest(schema, modules);
    const choices = await t.query(api.readingGroups.planChoices, {});
    expect(choices.map((plan) => plan.id)).toContain("canonico");
    expect(choices.map((plan) => plan.id)).toContain("ansiedad");
  });

  it("sin sesión: mine vacío, create y join piden sesión", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.readingGroups.mine, {})).toEqual([]);
    await expect(t.mutation(api.readingGroups.create, { planId: "duelo", kind: "familia" })).rejects.toThrow("No autenticado");
    await expect(t.mutation(api.readingGroups.join, { token: "abcdefghijkmnpqr" })).rejects.toThrow("No autenticado");
    await expect(
      t.mutation(api.readingGroups.leave, { groupId: "x" as Id<"readingGroups"> }),
    ).rejects.toThrow();
  });
});
