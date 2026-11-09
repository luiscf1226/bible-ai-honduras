import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  EXPO_PUSH_URL,
  EXPO_RECEIPTS_URL,
  friendMessageNotice,
  isExpoPushToken,
  MAX_TOKENS_PER_USER,
  MESSAGE_PUSH_QUIET_MS,
  shouldPushMessage,
} from "./pushCore";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./friends.ts": () => import("./friends"),
  "./push.ts": () => import("./push"),
  "./users.ts": () => import("./users"),
};

type T = ReturnType<typeof convexTest>;
type Sent = { to: string; title: string; body: string; data: { kind: string; url: string }; channelId?: string };

const ANA_PHONE = "ExponentPushToken[ana-phone]";
const BETO_PHONE = "ExponentPushToken[beto-phone]";

let sent: Sent[];
let deadTokens: Set<string>;

beforeEach(() => {
  sent = [];
  deadTokens = new Set();
  vi.useFakeTimers({ now: Date.parse("2026-11-09T15:00:00Z") });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: string }) => {
      if (url === EXPO_PUSH_URL) {
        const messages = JSON.parse(init.body) as Sent[];
        sent.push(...messages);
        const data = messages.map((message, index) =>
          deadTokens.has(message.to)
            ? { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }
            : { status: "ok", id: `ticket-${sent.length}-${index}` },
        );
        return new Response(JSON.stringify({ data }));
      }
      if (url === EXPO_RECEIPTS_URL) return new Response(JSON.stringify({ data: {} }));
      throw new Error(`fetch no esperado: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function signUp(t: T, clerkId: string, name: string, phone?: string) {
  const user = t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev", name });
  await user.mutation(api.users.upsert, {});
  await user.mutation(api.friends.acceptRules, {});
  if (phone) await user.mutation(api.push.register, { token: phone, platform: "ios" });
  return user;
}

async function deliverPush(t: T) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function friends(t: T) {
  const ana = await signUp(t, "user_ana", "Ana López", ANA_PHONE);
  const beto = await signUp(t, "user_beto", "Beto Martínez", BETO_PHONE);
  const betoCode = (await beto.query(api.users.current, {}))!.referralCode;
  const { friendshipId } = await ana.mutation(api.friends.request, { code: betoCode });
  await beto.mutation(api.friends.accept, { friendshipId: friendshipId! });
  await deliverPush(t);
  sent = [];
  return { ana, beto, friendshipId: friendshipId! };
}

describe("pushCore", () => {
  it("reconoce tokens de Expo", () => {
    expect(isExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc123]")).toBe(true);
    expect(isExpoPushToken("abc123")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  it("una conversación seguida suena una vez", () => {
    const now = 1_000_000;
    expect(shouldPushMessage({ unreadBefore: 0, lastMessageAt: now - 1000, now })).toBe(true);
    expect(shouldPushMessage({ unreadBefore: 2, lastMessageAt: now - 1000, now })).toBe(false);
    expect(shouldPushMessage({ unreadBefore: 2, lastMessageAt: now - MESSAGE_PUSH_QUIET_MS, now })).toBe(true);
  });

  it("el texto largo se recorta en una línea", () => {
    const notice = friendMessageNotice("Ana L.", "f1", { kind: "text", text: `hola\n\n${"a".repeat(300)}` });
    expect(notice.body.length).toBeLessThanOrEqual(140);
    expect(notice.body.startsWith("hola a")).toBe(true);
    expect(notice.data.url).toBe("/amigos/f1");
  });
});

describe("push", () => {
  it("avisa la solicitud de amistad y la aceptación, y abre el chat", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana López", ANA_PHONE);
    const beto = await signUp(t, "user_beto", "Beto Martínez", BETO_PHONE);
    const betoCode = (await beto.query(api.users.current, {}))!.referralCode;

    const { friendshipId } = await ana.mutation(api.friends.request, { code: betoCode });
    await deliverPush(t);
    expect(sent).toEqual([
      expect.objectContaining({
        to: BETO_PHONE,
        title: "Nueva solicitud de amistad",
        body: "Ana L. quiere ser tu amigo en 3C.",
        data: { kind: "friend_request", url: `/amigos/${friendshipId}` },
        channelId: "amigos",
      }),
    ]);

    sent = [];
    await beto.mutation(api.friends.accept, { friendshipId: friendshipId! });
    await deliverPush(t);
    expect(sent).toEqual([
      expect.objectContaining({ to: ANA_PHONE, title: "Beto M. aceptó tu solicitud", data: { kind: "friend_accepted", url: `/amigos/${friendshipId}` } }),
    ]);
  });

  it("un mensaje avisa; los siguientes sin leer no, hasta que lo lee o pasa un rato", async () => {
    const t = convexTest(schema, modules);
    const { ana, beto, friendshipId } = await friends(t);

    await ana.mutation(api.friends.sendText, { friendshipId, text: "¿Vamos al culto?" });
    await ana.mutation(api.friends.sendText, { friendshipId, text: "Paso por vos a las 6" });
    await deliverPush(t);
    expect(sent).toEqual([expect.objectContaining({ to: BETO_PHONE, title: "Ana L.", body: "¿Vamos al culto?" })]);

    sent = [];
    await beto.mutation(api.friends.markRead, { friendshipId });
    await ana.mutation(api.friends.sendText, { friendshipId, text: "¿Me leíste?" });
    await deliverPush(t);
    expect(sent.map((message) => message.body)).toEqual(["¿Me leíste?"]);

    sent = [];
    vi.advanceTimersByTime(MESSAGE_PUSH_QUIET_MS);
    await ana.mutation(api.friends.sendText, { friendshipId, text: "Ya salí" });
    await deliverPush(t);
    expect(sent.map((message) => message.body)).toEqual(["Ya salí"]);
  });

  it("quien escribe no recibe su propio aviso", async () => {
    const t = convexTest(schema, modules);
    const { beto, friendshipId } = await friends(t);
    await beto.mutation(api.friends.sendText, { friendshipId, text: "Hola" });
    await deliverPush(t);
    expect(sent.map((message) => message.to)).toEqual([ANA_PHONE]);
  });

  it("un teléfono que ya no existe se olvida", async () => {
    const t = convexTest(schema, modules);
    const { ana, friendshipId } = await friends(t);
    deadTokens.add(BETO_PHONE);
    await ana.mutation(api.friends.sendText, { friendshipId, text: "Hola" });
    await deliverPush(t);
    const rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows.map((row) => row.token)).toEqual([ANA_PHONE]);
  });

  it("al cambiar de cuenta en el mismo teléfono, el token pasa a la nueva; al cerrar sesión se borra", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "user_ana", "Ana López", ANA_PHONE);
    const carla = await signUp(t, "user_carla", "Carla Ríos", ANA_PHONE);
    let rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows).toHaveLength(1);
    const carlaId = (await carla.query(api.users.current, {}))!._id;
    expect(rows[0]!.userId).toBe(carlaId);

    // Ya sin sesión (cerró sesión sin red y el teléfono reintenta): se suelta igual.
    await t.mutation(api.push.unregister, { token: ANA_PHONE });
    rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows).toHaveLength(0);
  });

  it("guarda pocos teléfonos por cuenta y rechaza tokens raros", async () => {
    const t = convexTest(schema, modules);
    const ana = await signUp(t, "user_ana", "Ana López");
    expect(await ana.mutation(api.push.register, { token: "no-es-un-token", platform: "android" })).toEqual({ registered: false });
    for (let index = 0; index < MAX_TOKENS_PER_USER + 2; index += 1) {
      vi.advanceTimersByTime(1000);
      await ana.mutation(api.push.register, { token: `ExponentPushToken[tel-${index}]`, platform: "android" });
    }
    const rows = await t.run((ctx) => ctx.db.query("pushTokens").collect());
    expect(rows).toHaveLength(MAX_TOKENS_PER_USER);
    expect(rows.map((row) => row.token)).not.toContain("ExponentPushToken[tel-0]");
  });
});
