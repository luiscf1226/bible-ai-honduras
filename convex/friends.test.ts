import { convexTest } from "convex-test";
import type { PaginationResult } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ThreadMessage } from "./friends";
import {
  AUTO_SUSPEND_REPORTERS,
  DECLINED_COOLDOWN_DAYS,
  MAX_CONNECTIONS,
  MESSAGE_MAX_LENGTH,
  MESSAGES_PER_MINUTE,
  REPORTS_PER_DAY,
  REQUESTS_PER_DAY,
  REQUESTS_PER_TARGET_PER_WEEK,
} from "./friendsCore";
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

/** Toda la conversación, de la más vieja a la más nueva, recorriendo las páginas. */
async function messagesOf(client: Client, friendshipId: Id<"friendships">) {
  const all: ThreadMessage[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: PaginationResult<ThreadMessage> = await client.query(api.friends.messages, { friendshipId, paginationOpts: { numItems: 50, cursor } });
    all.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return all.reverse();
}

async function friendshipRow(t: T, friendshipId: Id<"friendships">) {
  return await t.run((ctx) => ctx.db.get(friendshipId));
}

async function userIdOf(client: Client): Promise<Id<"users">> {
  return (await client.query(api.users.current, {}))!._id;
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

const DAY_MS = 24 * 60 * 60 * 1000;

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

  it("cancelar borra la solicitud y se puede volver a pedir", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await ana.mutation(api.friends.remove, { friendshipId: sent.friendshipId! })).toEqual({ removed: true });
    expect((await beto.query(api.friends.overview, {}))?.requests).toEqual([]);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("sent");
  });

  it("después de un rechazo no se puede volver a pedir por una semana", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    expect(await beto.mutation(api.friends.remove, { friendshipId: sent.friendshipId! })).toEqual({ removed: true });
    expect((await beto.query(api.friends.overview, {}))?.requests).toEqual([]);

    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("try_later");
    vi.setSystemTime(Date.now() + (DECLINED_COOLDOWN_DAYS - 1) * DAY_MS);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("try_later");
    vi.setSystemTime(Date.now() + DAY_MS + 1);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("sent");
  });

  it("pedir y cancelar en bucle a la misma persona tiene tope por semana", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    for (let index = 0; index < REQUESTS_PER_TARGET_PER_WEEK; index += 1) {
      const sent = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
      expect(sent.status).toBe("sent");
      await ana.mutation(api.friends.remove, { friendshipId: sent.friendshipId! });
    }
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("try_later");
    vi.setSystemTime(Date.now() + 7 * DAY_MS + 1);
    expect((await ana.mutation(api.friends.request, { code: await codeOf(beto) })).status).toBe("sent");
  });

  it("tope de solicitudes por día, contando las canceladas", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    for (let index = 0; index < REQUESTS_PER_DAY; index += 1) {
      const other = await signUp(t, `user_p${index}`, `Persona ${index}`);
      const sent = await ana.mutation(api.friends.request, { code: await codeOf(other) });
      expect(sent.status).toBe("sent");
      await ana.mutation(api.friends.remove, { friendshipId: sent.friendshipId! });
    }
    const last = await signUp(t, "user_ultima", "Última");
    expect((await ana.mutation(api.friends.request, { code: await codeOf(last) })).status).toBe("daily_limit");
    // Aceptar una solicitud que te mandaron no cuenta como pedir.
    const fromLast = await last.mutation(api.friends.request, { code: await codeOf(ana) });
    expect((await ana.mutation(api.friends.request, { code: await codeOf(last) })).status).toBe("accepted");
    expect(fromLast.status).toBe("sent");
    vi.setSystemTime(Date.now() + DAY_MS + 1);
    const tomorrow = await signUp(t, "user_manana", "Mañana");
    expect((await ana.mutation(api.friends.request, { code: await codeOf(tomorrow) })).status).toBe("sent");
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
    const messages = await messagesOf(beto, friendshipId);
    expect(messages.map((message) => [message.fromMe, message.text])).toEqual([
      [false, "Hola Beto\n\n¿cómo estás?"],
      [false, "Te extraño en la célula"],
    ]);

    await beto.mutation(api.friends.markRead, { friendshipId, upTo: messages[1]!.id });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(0);
    // Ana ve hasta dónde leyó Beto.
    const anaThread = await ana.query(api.friends.thread, { friendshipId });
    expect(anaThread?.friendReadAt).toBeGreaterThanOrEqual(messages[1]!.createdAt);
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
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    for (let index = 0; index < MESSAGES_PER_MINUTE; index += 1) {
      expect((await ana.mutation(api.friends.sendText, { friendshipId, text: `mensaje ${index}` })).status).toBe("ok");
    }
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "uno más" })).toEqual({ status: "rate_limited" });
    // Un mensaje rechazado por el filtro no gasta; el balde se rellena a 20 por minuto.
    vi.setSystemTime(Date.now() + 60_000 / MESSAGES_PER_MINUTE);
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "puta" })).toEqual({ status: "offensive" });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "ya" })).toEqual({ status: "ok" });
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "otro" })).toEqual({ status: "rate_limited" });
  });

  it("borrar la conversación no reinicia el límite de ritmo", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    for (let index = 0; index < MESSAGES_PER_MINUTE; index += 1) {
      await ana.mutation(api.friends.sendText, { friendshipId, text: `mensaje ${index}` });
    }
    // Dejan de ser amigos (se borra todo) y se vuelven a agregar enseguida.
    await ana.mutation(api.friends.remove, { friendshipId });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toHaveLength(0);
    const again = await ana.mutation(api.friends.request, { code: await codeOf(beto) });
    await beto.mutation(api.friends.accept, { friendshipId: again.friendshipId! });
    expect(await ana.mutation(api.friends.sendText, { friendshipId: again.friendshipId!, text: "hola de nuevo" })).toEqual({
      status: "rate_limited",
    });
  });

  it("el filtro no se esquiva con caracteres invisibles ni separadores", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friendsPair(t);
    for (const text of ["pu\u200bta", "pu.ta", "ｐｕｔａ", "mier da"]) {
      expect(await ana.mutation(api.friends.sendText, { friendshipId, text }), JSON.stringify(text)).toEqual({ status: "offensive" });
    }
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "Se me trabó la computadora" })).toEqual({ status: "ok" });
  });

  it("no leídos y vista previa viven en la amistad: la lista no lee mensajes", async () => {
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    await ana.mutation(api.friends.sendText, { friendshipId, text: "uno" });
    await ana.mutation(api.friends.sendText, { friendshipId, text: `dos ${"palabra ".repeat(40)}` });
    const row = (await friendshipRow(t, friendshipId))!;
    const anaId = await userIdOf(ana);
    const betoSide = row.userA === anaId ? "unreadB" : "unreadA";
    const anaSide = row.userA === anaId ? "unreadA" : "unreadB";
    expect(row[betoSide]).toBe(2);
    expect(row[anaSide]).toBe(0);
    expect(row.lastMessage).toMatchObject({ senderId: anaId, kind: "text" });
    expect(row.lastMessage!.snippet.length).toBeLessThanOrEqual(120);
    expect(row.lastMessage!.snippet.endsWith("…")).toBe(true);

    // Aunque los mensajes ya no estén, la lista sale de la fila.
    await t.run(async (ctx) => {
      for (const message of await ctx.db.query("directMessages").collect()) await ctx.db.delete(message._id);
    });
    expect(await beto.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 2 });
    const list = await beto.query(api.friends.overview, {});
    expect(list?.friends[0]).toMatchObject({ unread: 2, lastMessageAt: row.lastMessageAt });
    expect(list?.friends[0]?.preview.startsWith("dos palabra")).toBe(true);

    // Contestar deja el propio contador en cero.
    await beto.mutation(api.friends.sendText, { friendshipId, text: "¡hola!" });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(0);
    expect(await ana.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 1 });
  });

  it("más de 100 sin leer se cuentan todos", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    for (let index = 0; index < 120; index += 1) {
      vi.setSystemTime(Date.now() + 60_000);
      await ana.mutation(api.friends.sendText, { friendshipId, text: `m${index}` });
    }
    expect((await beto.query(api.friends.summary, {})).unread).toBe(120);
  });

  it("marcar leído hasta el último mensaje que se ve; lo que llegó después sigue sin leer", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    for (const text of ["a", "b", "c"]) {
      vi.setSystemTime(Date.now() + 1_000);
      await ana.mutation(api.friends.sendText, { friendshipId, text });
    }
    const [, second, third] = await messagesOf(beto, friendshipId);
    await beto.mutation(api.friends.markRead, { friendshipId, upTo: second!.id });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(1);
    expect((await ana.query(api.friends.thread, { friendshipId }))?.friendReadAt).toBe(second!.createdAt);
    // Un id de otro chat no sirve.
    const caro = await signUp(t, "user_caro", "Caro");
    const withCaro = await caro.mutation(api.friends.request, { code: await codeOf(ana) });
    await ana.mutation(api.friends.accept, { friendshipId: withCaro.friendshipId! });
    await caro.mutation(api.friends.sendText, { friendshipId: withCaro.friendshipId!, text: "hola" });
    const [caroMessage] = await messagesOf(ana, withCaro.friendshipId!);
    await beto.mutation(api.friends.markRead, { friendshipId, upTo: caroMessage!.id });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(1);

    await beto.mutation(api.friends.markRead, { friendshipId, upTo: third!.id });
    expect((await beto.query(api.friends.summary, {})).unread).toBe(0);
  });

  it("una amistad vieja sin contadores ni vista previa cuenta como cero", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana");
    const beto = await signUp(t, "user_beto", "Beto");
    const [anaId, betoId] = [await userIdOf(ana), await userIdOf(beto)];
    const friendshipId = await t.run((ctx) =>
      ctx.db.insert("friendships", {
        ...(anaId < betoId ? { userA: anaId, userB: betoId } : { userA: betoId, userB: anaId }),
        requestedBy: anaId,
        status: "accepted",
        createdAt: 1,
        acceptedAt: 2,
        lastMessageAt: 3,
      }),
    );
    expect(await beto.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 0 });
    expect((await beto.query(api.friends.overview, {}))?.friends).toMatchObject([{ friendshipId, unread: 0, lastMessageAt: 3 }]);
    expect(await ana.mutation(api.friends.sendText, { friendshipId, text: "hola" })).toEqual({ status: "ok" });
    expect(await beto.query(api.friends.summary, {})).toEqual({ friends: 1, requests: 0, unread: 1 });
  });

  it("el historial se pagina del más nuevo al más viejo", async () => {
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    const anaId = await userIdOf(ana);
    await t.run(async (ctx) => {
      for (let index = 0; index < 230; index += 1) {
        await ctx.db.insert("directMessages", { friendshipId, senderId: anaId, kind: "text", text: `m${index}`, createdAt: 1_000 + index });
      }
    });
    const first = await beto.query(api.friends.messages, { friendshipId, paginationOpts: { numItems: 50, cursor: null } });
    expect(first.page.map((message) => message.text).slice(0, 2)).toEqual(["m229", "m228"]);
    expect(first.isDone).toBe(false);
    const all = await messagesOf(beto, friendshipId);
    expect(all).toHaveLength(230);
    expect(all[0]?.text).toBe("m0");
    // Ajenos al par: página vacía.
    const caro = await signUp(t, "user_caro", "Caro");
    expect(await caro.query(api.friends.messages, { friendshipId, paginationOpts: { numItems: 50, cursor: null } })).toMatchObject({
      page: [],
      isDone: true,
    });
  });

  it("los mensajes del día se cuentan para el dashboard aunque se borre la conversación", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-01T15:00:00Z") });
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friendsPair(t);
    await ana.mutation(api.friends.sendText, { friendshipId, text: "hola" });
    await beto.mutation(api.friends.sendText, { friendshipId, text: "hola, ¿qué tal?" });
    await ana.mutation(api.friends.block, { friendshipId });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const stats = await t.run((ctx) => ctx.db.query("friendDailyStats").collect());
    expect(stats.map((row) => row.day)).toEqual(["2026-11-01"]);
    expect(stats.reduce((sum, row) => sum + row.messages, 0)).toBe(2);
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

    expect((await messagesOf(beto, friendshipId)).map((message) => message.verse)).toEqual([
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
    const thread = await messagesOf(ana, friendshipId);
    const scam = thread.find((message) => message.text?.includes("plata"))!;
    const mine = thread.find((message) => message.fromMe)!;

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

  it("cuando varias personas distintas reportan con evidencia a alguien, Amigos lo suspende solo", async () => {
    const t = convexTest(schema, modules);
    const carla = await signUp(t, "user_carla", "Carla Ríos");
    const reporters = [];
    for (let index = 0; index < AUTO_SUSPEND_REPORTERS; index += 1) {
      const reporter = await signUp(t, `user_r${index}`, `Persona ${index}`);
      const sent = await reporter.mutation(api.friends.request, { code: await codeOf(carla) });
      await carla.mutation(api.friends.accept, { friendshipId: sent.friendshipId! });
      await carla.mutation(api.friends.sendText, { friendshipId: sent.friendshipId!, text: "mandame plata" });
      reporters.push({ reporter, friendshipId: sent.friendshipId! });
    }
    const suspended = async () => (await carla.query(api.friends.overview, {}))?.suspended;

    const [first, ...rest] = reporters;
    // La misma persona reportando varias veces no alcanza.
    await first!.reporter.mutation(api.friends.report, { friendshipId: first!.friendshipId, reason: "ofensivo" });
    await first!.reporter.mutation(api.friends.report, { friendshipId: first!.friendshipId, reason: "ofensivo" });
    for (const { reporter, friendshipId } of rest.slice(0, -1)) {
      await reporter.mutation(api.friends.report, { friendshipId, reason: "ofensivo" });
    }
    expect(await suspended()).toBe(false);

    const last = rest.at(-1)!;
    await last.reporter.mutation(api.friends.report, { friendshipId: last.friendshipId, reason: "sexual" });
    expect(await suspended()).toBe(true);
    expect((await carla.mutation(api.friends.sendText, { friendshipId: first!.friendshipId, text: "hola" })).status).toBe("suspended");
  });

  it("tres cuentas que le mandan solicitud a alguien no pueden reportarla desde su propia solicitud", async () => {
    const t = convexTest(schema, modules);
    const victima = await signUp(t, "user_victima", "Víctima");
    for (let index = 0; index < AUTO_SUSPEND_REPORTERS; index += 1) {
      const atacante = await signUp(t, `user_atacante${index}`, `Atacante ${index}`);
      const sent = await atacante.mutation(api.friends.request, { code: await codeOf(victima) });
      expect(await atacante.mutation(api.friends.report, { friendshipId: sent.friendshipId!, reason: "sexual" })).toEqual({
        status: "not_found",
      });
    }
    expect((await victima.query(api.friends.overview, {}))?.suspended).toBe(false);
    expect(await t.query(internal.friends.recentReports, {})).toEqual([]);
  });

  it("reportes de amistades donde la persona no escribió nada quedan en la cola sin suspender", async () => {
    const t = convexTest(schema, modules);
    const victima = await signUp(t, "user_victima", "Víctima");
    for (let index = 0; index < AUTO_SUSPEND_REPORTERS + 1; index += 1) {
      const atacante = await signUp(t, `user_atacante${index}`, `Atacante ${index}`);
      const sent = await atacante.mutation(api.friends.request, { code: await codeOf(victima) });
      await victima.mutation(api.friends.accept, { friendshipId: sent.friendshipId! });
      // El atacante escribe, la víctima no contesta.
      await atacante.mutation(api.friends.sendText, { friendshipId: sent.friendshipId!, text: "hola" });
      expect(await atacante.mutation(api.friends.report, { friendshipId: sent.friendshipId!, reason: "sexual" })).toEqual({
        status: "ok",
      });
    }
    expect((await victima.query(api.friends.overview, {}))?.suspended).toBe(false);
    const queue = await t.query(internal.friends.recentReports, {});
    expect(queue).toHaveLength(AUTO_SUSPEND_REPORTERS + 1);
    expect(queue.every((row) => row.countsForSuspension === false && row.evidence.length === 0)).toBe(true);
  });

  it("una solicitud recibida se puede reportar, pero no cuenta para la suspensión", async () => {
    const t = convexTest(schema, modules);
    const victima = await signUp(t, "user_victima", "Víctima");
    for (let index = 0; index < AUTO_SUSPEND_REPORTERS; index += 1) {
      const otra = await signUp(t, `user_otra${index}`, `Otra ${index}`);
      const sent = await victima.mutation(api.friends.request, { code: await codeOf(otra) });
      expect(await otra.mutation(api.friends.report, { friendshipId: sent.friendshipId!, reason: "ofensivo" })).toEqual({ status: "ok" });
    }
    expect((await victima.query(api.friends.overview, {}))?.suspended).toBe(false);
    expect((await t.query(internal.friends.recentReports, {})).map((row) => row.countsForSuspension)).toEqual([false, false, false]);
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

describe("friends — amigo de prueba para App Review", () => {
  it("la cuenta demo recibe al amigo 3C con un saludo y un versículo, una sola vez", async () => {
    const t = convexTest(schema, modules);
    await seedVerses(t);
    const demo = asUser(t, "user_demo");
    await demo.mutation(api.users.upsert, {});
    await t.run((ctx) => ctx.db.query("users").first().then((row) => ctx.db.patch(row!._id, { email: "demo@example.com" })));

    expect(await t.mutation(internal.friends.seedReviewFriend, { email: "nadie@example.com" })).toEqual({ status: "demo_not_found" });
    expect(await t.mutation(internal.friends.seedReviewFriend, { email: "demo@example.com" })).toEqual({ status: "created" });
    expect(await t.mutation(internal.friends.seedReviewFriend, { email: "demo@example.com" })).toEqual({ status: "exists" });

    await demo.mutation(api.friends.acceptRules, {});
    const overview = await demo.query(api.friends.overview, {});
    expect(overview?.friends).toHaveLength(1);
    expect(overview?.friends[0]).toMatchObject({ name: "3C" });
    const page = await demo.query(api.friends.messages, {
      friendshipId: overview!.friends[0]!.friendshipId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.map((message) => message.kind).sort()).toEqual(["text", "verse"]);
  });
});
