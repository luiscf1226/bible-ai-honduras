import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_CONNECTIONS, MESSAGE_MAX_LENGTH, MESSAGES_PER_MINUTE, REPORTS_PER_DAY } from "./friendsCore";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./friends.ts": () => import("./friends"),
  "./users.ts": () => import("./users"),
  "./history.ts": () => import("./history"),
  "./memorize.ts": () => import("./memorize"),
  "./verseFeed.ts": () => import("./verseFeed"),
  "./prayers.ts": () => import("./prayers"),
  "./reading.ts": () => import("./reading"),
  "./readingPlans.ts": () => import("./readingPlans"),
  "./readingPlanCatalog.ts": () => import("./readingPlanCatalog"),
  "./readingGroups.ts": () => import("./readingGroups"),
  "./devotional.ts": () => import("./devotional"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

type T = ReturnType<typeof convexTest>;

function asUser(t: T, clerkId: string, name?: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev", ...(name ? { name } : {}) });
}

type Client = ReturnType<typeof asUser>;

async function signUp(t: T, clerkId: string, name?: string, { rules = true } = {}) {
  const user = asUser(t, clerkId, name);
  await user.mutation(api.users.upsert, {});
  if (rules) await user.mutation(api.friends.acceptRules, {});
  return user;
}

async function codeOf(user: Client): Promise<string> {
  return (await user.query(api.users.current, {}))!.referralCode;
}

/** Ana y Beto ya amigos. */
async function friendsPair(t: T) {
  const ana = await signUp(t, "user_ana", "Ana López");
  const beto = await signUp(t, "user_beto", "Beto Martínez Cruz");
  const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
  const friendshipId = sent.friendshipId!;
  expect(await beto.mutation(api.friends.accept, { friendshipId })).toEqual({ status: "ok" });
  return { ana, beto, friendshipId };
}

async function seedVerses(t: T) {
  await t.run(async (ctx) => {
    const rows = [
      { verse: 1, text: "Jehová es mi pastor; nada me faltará." },
      { verse: 2, text: "En lugares de delicados pastos me hará yacer:" },
      { verse: 3, text: "Confortará mi alma;" },
    ];
    for (const row of rows) {
      await ctx.db.insert("verses", {
        book: "Salmos",
        chapter: 23,
        version: "RV1909",
        embedding: Array.from({ length: 1024 }, () => 0),
        ...row,
      });
    }
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("friends — normas y solicitudes", () => {
  it("sin aceptar las normas no se puede pedir amistad; aceptarlas guarda la fecha una vez", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana", { rules: false });
    const beto = await signUp(t, "user_beto", "Beto");
    expect(await ana.mutation(api.friends.request, { code: await codeOf(beto) })).toEqual({ status: "rules_required" });
    expect((await ana.query(api.friends.overview, {}))?.rulesAccepted).toBe(false);

    const first = await ana.mutation(api.friends.acceptRules, {});
    const second = await ana.mutation(api.friends.acceptRules, {});
    expect(second.acceptedAt).toBe(first.acceptedAt);
    expect((await ana.query(api.users.current, {}))?.communityRulesAcceptedAt).toBe(first.acceptedAt);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("sent");
  });

  it("pedir, ver la solicitud del otro lado y aceptarla", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana López");
    const beto = await signUp(t, "user_beto", "Beto Martínez Cruz");
    const betoCode = await codeOf(beto);

    // El código se acepta en minúsculas y sin guion.
    const sent = await ana.mutation(api.friends.request, { code: betoCode.toLowerCase().replace("-", "") });
    expect(sent.status).toBe("sent");

    const anaView = await ana.query(api.friends.overview, {});
    expect(anaView?.sent).toMatchObject([{ name: "Beto M.", initial: "B" }]);
    const betoView = await beto.query(api.friends.overview, {});
    expect(betoView?.requests).toMatchObject([{ friendshipId: sent.friendshipId, name: "Ana L." }]);
    expect(await beto.query(api.friends.summary, {})).toEqual({ friends: 0, requests: 1, unread: 0 });

    // Quien pidió no puede aceptar su propia solicitud.
    expect(await ana.mutation(api.friends.accept, { friendshipId: sent.friendshipId! })).toEqual({ status: "not_found" });
    expect(await beto.mutation(api.friends.accept, { friendshipId: sent.friendshipId! })).toEqual({ status: "ok" });

    const after = await ana.query(api.friends.overview, {});
    expect(after?.friends).toMatchObject([{ name: "Beto M.", preview: "Todavía no se han escrito", unread: 0 }]);
    expect(after?.sent).toEqual([]);
    expect(await ana.mutation(api.friends.request, { code: betoCode })).toMatchObject({ status: "already_friends" });
  });

  it("si los dos se piden, la segunda solicitud acepta la primera", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const first = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await ana.mutation(api.friends.request, { code: await codeOf(beto) })).toMatchObject({ status: "already_sent" });
    const second = await beto.mutation(api.friends.request, { code: await codeOf(ana) });
    expect(second).toEqual({ status: "accepted", friendshipId: first.friendshipId });
    const rows = await t.run((ctx) => ctx.db.query("friendships").collect());
    expect(rows).toHaveLength(1);
  });

  it("código propio, inexistente o mal escrito", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    expect((await ana.mutation(api.friends.request, { code: await codeOf(ana) })).status).toBe("self");
    expect((await ana.mutation(api.friends.request, { code: "BAH-ZZZZZZZ" })).status).toBe("not_found");
    expect((await ana.mutation(api.friends.request, { code: "hola" })).status).toBe("not_found");
    expect(await ana.query(api.friends.previewByCode, { code: await codeOf(ana) })).toEqual({ status: "self" });
    expect(await t.query(api.friends.previewByCode, { code: "BAH-ZZZZZZZ" })).toEqual({ status: "signed_out" });
  });

  it("la tarjeta del código dice la relación", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana López");
    const beto = await signUp(t, "user_beto", "Beto");
    const anaCode = await codeOf(ana);
    expect(await beto.query(api.friends.previewByCode, { code: anaCode })).toMatchObject({
      status: "ok",
      name: "Ana L.",
      code: anaCode,
      relation: "none",
    });
    const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await beto.query(api.friends.previewByCode, { code: anaCode })).toMatchObject({
      relation: "received",
      friendshipId: sent.friendshipId,
    });
    expect(await ana.query(api.friends.previewByCode, { code: await codeOf(beto) })).toMatchObject({ relation: "sent" });
  });

  it("rechazar o cancelar borra la solicitud y se puede volver a pedir", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await beto.mutation(api.friends.remove, { friendshipId: sent.friendshipId! })).toEqual({ removed: true });
    expect((await beto.query(api.friends.overview, {}))?.requests).toEqual([]);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("sent");
  });

  it("nadie ajeno al par puede leer, aceptar, borrar ni escribir", async () => {
    const t = convexTest(schema, modules);
    const { friendshipId } = await friendsPair(t);
    const caro = await signUp(t, "user_caro", "Caro");
    expect(await caro.query(api.friends.thread, { friendshipId })).toBeNull();
    expect(await caro.mutation(api.friends.accept, { friendshipId })).toEqual({ status: "not_found" });
    expect(await caro.mutation(api.friends.remove, { friendshipId })).toEqual({ removed: false });
    expect(await caro.mutation(api.friends.block, { friendshipId })).toEqual({ blocked: false });
    expect(await caro.mutation(api.friends.report, { friendshipId, reason: "ofensivo" })).toEqual({ status: "not_found" });
    expect(await caro.mutation(api.friends.sendText, { friendshipId, text: "hola" })).toEqual({ status: "not_friends" });
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
  });

  it("tope de amigos y solicitudes por cuenta", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const anaId = (await ana.query(api.users.current, {}))!._id;
    await t.run(async (ctx) => {
      for (let index = 0; index < MAX_CONNECTIONS; index += 1) {
        const other = await ctx.db.insert("users", { clerkId: `relleno_${index}`, bibleVersion: "RV1909", referralCode: `BAH-R${String(index).padStart(6, "0")}` });
        const [userA, userB] = anaId < other ? [anaId, other] : [other, anaId];
        await ctx.db.insert("friendships", { userA, userB, requestedBy: anaId, status: "pending", createdAt: 1 });
      }
    });
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("too_many");
  });
});

describe("friends — mensajes", () => {
  it("texto: llega, cuenta como no leído del otro lado y se limpia al abrir el chat", async () => {
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);

    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "  Hola Beto\n\n\n\n¿cómo estás?  " })).toEqual({
      status: "ok",
    });
    await ana.mutation(api.friends.sendText, { friendshipId, text: "Te extraño en la célula" });

    expect(await beto.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 2 });
    expect(await ana.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 0 });
    const betoList = await beto.query(api.friends.overview, {});
    expect(betoList?.friends).toMatchObject([{ name: "Ana L.", preview: "Te extraño en la célula", unread: 2 }]);
    expect((await ana.query(api.friends.overview, {}))?.friends[0]?.preview).toBe("Vos: Te extraño en la célula");

    const thread = await beto.query(api.friends.thread, { friendshipId });
    expect(thread).toMatchObject({ status: "accepted", canWrite: true, friend: { name: "Ana L." } });
    expect(thread?.messages.map((message) => [message.fromMe, message.text])).toEqual([
      [false, "Hola Beto\n\n¿cómo estás?"],
      [false, "Te extraño en la célula"],
    ]);

    await beto.mutation(api.friends.markRead, { friendshipId });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(0);
    // Ana ve hasta dónde leyó Beto.
    const anaThread = await ana.query(api.friends.thread, { friendshipId });
    expect(anaThread?.friendReadAt).toBeGreaterThanOrEqual(anaThread!.messages[1]!.createdAt);
  });

  it("vacío, muy largo u ofensivo no se guarda", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "   \n " })).toEqual({ status: "empty" });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "a".repeat(MESSAGE_MAX_LENGTH + 1) })).toEqual({
      status: "too_long",
    });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "sos un hijueputa" })).toEqual({ status: "offensive" });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "P.U.T.A" })).toEqual({ status: "offensive" });
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "a".repeat(MESSAGE_MAX_LENGTH) })).toEqual({ status: "ok" });
  });

  it("límite de ritmo por minuto", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    for (let index = 0; index < MESSAGES_PER_MINUTE; index += 1) {
      expect((await ana.mutation(api.friends.sendText, { friendshipId, text: `mensaje ${index}` })).status).toBe("ok");
    }
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "uno más" })).toEqual({ status: "rate_limited" });
  });

  it("una solicitud pendiente todavía no deja escribir", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await ana.mutation(api.friends.sendText, { friendshipId: sent.friendshipId!, text: "hola" })).toEqual({
      status: "not_friends",
    });
    expect(await beto.query(api.friends.thread, { friendshipId: sent.friendshipId! })).toMatchObject({
      status: "pending",
      requestedByMe: false,
      canWrite: false,
    });
  });

  it("versículo: el texto lo pone el servidor desde RV1909 y el rango se acota", async () => {
    const t = convexTest(schema, modules);
    await seedVerses(t);
    const { ana, beto, friendshipId } = await friendsPair(t);

    expect(await ana.mutation(api.friends.sendVerse, { friendshipId, book: "Salmos", chapter: 23, verse: 1, verseEnd: 2 })).toEqual({
      status: "ok",
    });
    // Pide hasta el 9, pero el capítulo cargado llega al 3.
    await ana.mutation(api.friends.sendVerse, { friendshipId, book: "Salmos", chapter: 23, verse: 3, verseEnd: 9 });
    expect(await ana.mutation(api.friends.sendVerse, { friendshipId, book: "Salmos", chapter: 99, verse: 1 })).toEqual({
      status: "verse_not_found",
    });
    expect(await ana.mutation(api.friends.sendVerse, { friendshipId, book: "Salmos", chapter: 23, verse: 0 })).toEqual({
      status: "verse_not_found",
    });

    const thread = await beto.query(api.friends.thread, { friendshipId });
    expect(thread?.messages.map((message) => message.verse)).toEqual([
      {
        book: "Salmos",
        chapter: 23,
        verse: 1,
        verseEnd: 2,
        version: "RV1909",
        text: "Jehová es mi pastor; nada me faltará. En lugares de delicados pastos me hará yacer:",
      },
      { book: "Salmos", chapter: 23, verse: 3, version: "RV1909", text: "Confortará mi alma;" },
    ]);
    expect((await beto.query(api.friends.overview, {}))?.friends[0]?.preview).toBe("Versículo · Salmos 23:3");
  });

  it("una cuenta suspendida no escribe ni agrega amigos", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    const caro = await signUp(t, "user_caro", "Caro");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_ana"))
        .unique();
      await ctx.db.patch(row!._id, { friendsSuspendedAt: Date.now() });
    });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "hola" })).toEqual({ status: "suspended" });
    expect((await ana.mutation(api.friends.request, { code: await codeOf(caro) })).status).toBe("suspended");
    expect(await ana.query(api.friends.thread, { friendshipId })).toMatchObject({ canWrite: false, gate: "suspended" });
  });
});

describe("friends — bloquear y reportar", () => {
  it("bloquear borra la amistad y la conversación, y la otra persona ya no te encuentra", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    await beto.mutation(api.friends.sendText, { friendshipId, text: "hola" });

    expect(await ana.mutation(api.friends.block, { friendshipId })).toEqual({ blocked: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.query("friendships").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
    expect(await beto.query(api.friends.thread, { friendshipId })).toBeNull();
    expect((await beto.query(api.friends.overview, {}))?.friends).toEqual([]);

    // Beto no puede ni verla ni pedirle amistad de nuevo (sin saber que lo bloquearon).
    expect(await beto.query(api.friends.previewByCode, { code: await codeOf(ana) })).toEqual({ status: "not_found" });
    expect((await beto.mutation(api.friends.request, { code: await codeOf(ana) })).status).toBe("not_found");
    // Ana tampoco lo agrega por error mientras siga bloqueado.
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("not_found");

    const list = await ana.query(api.friends.blocked, {});
    expect(list).toMatchObject([{ name: "Beto M." }]);
    expect(await beto.mutation(api.friends.unblock, { blockId: list[0]!.blockId })).toEqual({ unblocked: false });
    expect(await ana.mutation(api.friends.unblock, { blockId: list[0]!.blockId })).toEqual({ unblocked: true });
    expect((await beto.mutation(api.friends.request, { code: await codeOf(ana) })).status).toBe("sent");
  });

  it("dejar de ser amigos borra la conversación en páginas", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    await t.run(async (ctx) => {
      const row = (await ctx.db.get(friendshipId as Id<"friendships">))!;
      for (let index = 0; index < 300; index += 1) {
        await ctx.db.insert("directMessages", { friendshipId, senderId: row.userA, kind: "text", text: `m${index}`, createdAt: index });
      }
      await ctx.db.patch(friendshipId, { lastMessageAt: 299 });
    });
    expect(await ana.mutation(api.friends.remove, { friendshipId })).toEqual({ removed: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
  });

  it("reportar un mensaje guarda una copia; reportar y bloquear la conserva aunque se borre el chat", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await seedVerses(t);
    const { ana, beto, friendshipId } = await friendsPair(t);
    await ana.mutation(api.friends.sendText, { friendshipId, text: "hola" });
    await beto.mutation(api.friends.sendText, { friendshipId, text: "mandame plata, te la duplico" });
    await beto.mutation(api.friends.sendVerse, { friendshipId, book: "Salmos", chapter: 23, verse: 1 });
    const thread = await ana.query(api.friends.thread, { friendshipId });
    const scam = thread!.messages.find((message) => message.text?.includes("plata"))!;
    const mine = thread!.messages.find((message) => message.fromMe)!;

    // Solo se reporta lo que escribió la otra persona.
    expect(await ana.mutation(api.friends.report, { friendshipId, reason: "estafa", messageId: mine.id })).toEqual({
      status: "not_found",
    });
    expect(await ana.mutation(api.friends.report, { friendshipId, reason: "estafa", messageId: scam.id })).toEqual({ status: "ok" });
    expect(await ana.mutation(api.friends.report, { friendshipId, reason: "ofensivo", alsoBlock: true })).toEqual({ status: "ok" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const reports = await t.query(internal.friends.recentReports, {});
    expect(reports.map((row) => [row.reason, row.evidence.map((item) => item.text)])).toEqual([
      ["ofensivo", ["[Salmos 23:1] Jehová es mi pastor; nada me faltará.", "mandame plata, te la duplico"]],
      ["estafa", ["mandame plata, te la duplico"]],
    ]);
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
    expect(await ana.query(api.friends.blocked, {})).toHaveLength(1);
  });

  it("tope de reportes por día", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    for (let index = 0; index < REPORTS_PER_DAY; index += 1) {
      expect((await ana.mutation(api.friends.report, { friendshipId, reason: "ofensivo" })).status).toBe("ok");
    }
    expect(await ana.mutation(api.friends.report, { friendshipId, reason: "ofensivo" })).toEqual({ status: "too_many" });
  });
});
