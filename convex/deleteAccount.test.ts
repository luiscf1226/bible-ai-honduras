import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// Todos los módulos que el registro de funciones necesita para correr
// users.deleteAccount (users → history → voicesCatalog).
const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./users.ts": () => import("./users"),
  "./history.ts": () => import("./history"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string, email?: string) {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://example-dev.clerk.accounts.dev",
    ...(email ? { email } : {}),
  });
}

type Seeded = {
  userId: Id<"users">;
  conversationId: Id<"conversations">;
  storyId: Id<"stories">;
  storageId: Id<"_storage">;
};

// Siembra una fila en CADA tabla que referencia al usuario, más un blob real
// en `_storage` colgado de una escena de la historia.
async function seedEverything(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  label: string,
): Promise<Seeded> {
  return t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      module: "voices",
      characterId: "moises",
      createdAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      text: `pregunta de ${label}`,
    });
    await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      text: `respuesta para ${label}`,
    });

    const qaConversationId = await ctx.db.insert("conversations", {
      userId,
      module: "qa",
      createdAt: Date.now(),
    });
    await ctx.db.insert("messages", {
      conversationId: qaConversationId,
      role: "user",
      text: `segunda pregunta de ${label}`,
    });

    await ctx.db.insert("usage", { userId, module: "qa", day: "2026-09-10", count: 3 });
    await ctx.db.insert("usage", { userId, module: "stories", day: "lifetime", count: 1 });
    await ctx.db.insert("entitlements", {
      userId,
      isPro: true,
      source: "revenuecat_webhook",
      updatedAt: Date.now(),
    });

    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
    );
    const storyId = await ctx.db.insert("stories", {
      userId,
      catalogId: "el-mar-rojo-se-abre",
      status: "ready",
      createdAt: Date.now(),
      scenes: [
        {
          id: "el-mar-rojo-se-abre-1",
          order: 1,
          title: "El mar se abre",
          narration: `narración de ${label}`,
          reference: "Éxodo 14:21",
          status: "ready",
          storageId,
        },
        {
          id: "el-mar-rojo-se-abre-2",
          order: 2,
          title: "El pueblo cruza",
          narration: `segunda escena de ${label}`,
          reference: "Éxodo 14:22",
          status: "failed",
        },
      ],
    });

    return { userId, conversationId, storyId, storageId };
  });
}

// Snapshot tabla por tabla de lo que queda en la base.
async function tableDump(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    users: await ctx.db.query("users").collect(),
    conversations: await ctx.db.query("conversations").collect(),
    messages: await ctx.db.query("messages").collect(),
    usage: await ctx.db.query("usage").collect(),
    entitlements: await ctx.db.query("entitlements").collect(),
    stories: await ctx.db.query("stories").collect(),
    storage: await ctx.db.system.query("_storage").collect(),
  }));
}

function stubClerkDelete(status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_107");
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("users.deleteAccount — borrado en cascada tabla por tabla", () => {
  it("deja vacía cada tabla del usuario y borra el blob de _storage de la historia", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_107", "ana@example.hn");
    const userId = await ana.mutation(api.users.upsert, {});
    const seeded = await seedEverything(t, userId, "Ana");

    const before = await tableDump(t);
    expect(before.users).toHaveLength(1);
    expect(before.conversations).toHaveLength(2);
    expect(before.messages).toHaveLength(3);
    expect(before.usage).toHaveLength(2);
    expect(before.entitlements).toHaveLength(1);
    expect(before.stories).toHaveLength(1);
    expect(before.storage).toHaveLength(1);

    stubClerkDelete();
    const result = await ana.action(api.users.deleteAccount, {});

    expect(result.status).toBe("ok");
    expect(result.deleted).toEqual({
      messages: 3,
      conversations: 2,
      usage: 2,
      entitlements: 1,
      stories: 1,
      storyImages: 1,
      users: 1,
    });

    // Tabla por tabla: no queda nada.
    const after = await tableDump(t);
    expect(after.users).toHaveLength(0);
    expect(after.conversations).toHaveLength(0);
    expect(after.messages).toHaveLength(0);
    expect(after.usage).toHaveLength(0);
    expect(after.entitlements).toHaveLength(0);
    expect(after.stories).toHaveLength(0);

    // El blob no queda huérfano.
    expect(after.storage).toHaveLength(0);
    const blob = await t.run((ctx) => ctx.db.system.get(seeded.storageId));
    expect(blob).toBeNull();
  });

  it("no borra de más: los datos de otro usuario quedan intactos", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_ana_intacta", "ana@example.hn");
    const beto = asUser(t, "user_beto_intacto", "beto@example.hn");
    const anaId = await ana.mutation(api.users.upsert, {});
    const betoId = await beto.mutation(api.users.upsert, {});
    await seedEverything(t, anaId, "Ana");
    const betoSeed = await seedEverything(t, betoId, "Beto");

    stubClerkDelete();
    await ana.action(api.users.deleteAccount, {});

    const after = await tableDump(t);
    expect(after.users.map((row) => row.clerkId)).toEqual(["user_beto_intacto"]);
    expect(after.conversations.every((row) => row.userId === betoId)).toBe(true);
    expect(after.conversations).toHaveLength(2);
    expect(after.messages).toHaveLength(3);
    expect(after.messages.every((row) => row.text.includes("Beto"))).toBe(true);
    expect(after.usage).toHaveLength(2);
    expect(after.usage.every((row) => row.userId === betoId)).toBe(true);
    expect(after.entitlements).toHaveLength(1);
    expect(after.entitlements[0]?.userId).toBe(betoId);
    expect(after.stories).toHaveLength(1);
    expect(after.stories[0]?.userId).toBe(betoId);

    // El blob de Beto sobrevive; el de Ana no.
    expect(after.storage).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.system.get(betoSeed.storageId))).not.toBeNull();
  });

  it("una cuenta con muchas filas se borra completa en varias pasadas", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_gordo_107");
    const userId = await authed.mutation(api.users.upsert, {});

    // 700 mensajes en una conversación + 400 filas de usage: más de una pasada
    // del presupuesto de 256 filas por transacción.
    await t.run(async (ctx) => {
      const conversationId = await ctx.db.insert("conversations", {
        userId,
        module: "qa",
        createdAt: Date.now(),
      });
      for (let index = 0; index < 700; index += 1) {
        await ctx.db.insert("messages", {
          conversationId,
          role: index % 2 === 0 ? "user" : "assistant",
          text: `mensaje ${index}`,
        });
      }
      for (let index = 0; index < 400; index += 1) {
        await ctx.db.insert("usage", {
          userId,
          module: "qa",
          day: `2026-01-${String(index).padStart(4, "0")}`,
          count: 1,
        });
      }
    });

    stubClerkDelete();
    const result = await authed.action(api.users.deleteAccount, {});

    expect(result.status).toBe("ok");
    expect(result.deleted).toMatchObject({ messages: 700, conversations: 1, usage: 400, users: 1 });

    const after = await tableDump(t);
    expect(after.messages).toHaveLength(0);
    expect(after.conversations).toHaveLength(0);
    expect(after.usage).toHaveLength(0);
    expect(after.users).toHaveLength(0);
  });

  it("llama a la Backend API de Clerk con DELETE /v1/users/{id} y la secret key", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_clerk_107");
    await authed.mutation(api.users.upsert, {});

    const fetchMock = stubClerkDelete();
    await authed.action(api.users.deleteAccount, {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.clerk.com/v1/users/user_clerk_107");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_107");
  });

  it("si Clerk falla, los datos ya están borrados y el estado avisa (clerk_pendiente)", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_clerk_falla");
    const userId = await authed.mutation(api.users.upsert, {});
    await seedEverything(t, userId, "Falla");

    const fetchMock = vi.fn().mockResolvedValue(new Response("boom", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_107");

    const result = await authed.action(api.users.deleteAccount, {});

    expect(result).toMatchObject({ status: "clerk_pendiente", clerk: "failed" });
    const after = await tableDump(t);
    expect(after.users).toHaveLength(0);
    expect(after.stories).toHaveLength(0);
    expect(after.storage).toHaveLength(0);
  });

  it("sin CLERK_SECRET_KEY no deja el borrado a medias: purga y devuelve not_configured", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_sin_secret");
    const userId = await authed.mutation(api.users.upsert, {});
    await seedEverything(t, userId, "SinSecret");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CLERK_SECRET_KEY", "");

    const result = await authed.action(api.users.deleteAccount, {});

    expect(result).toMatchObject({ status: "clerk_pendiente", clerk: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await tableDump(t);
    expect(after.users).toHaveLength(0);
    expect(after.conversations).toHaveLength(0);
    expect(after.messages).toHaveLength(0);
    expect(after.usage).toHaveLength(0);
    expect(after.entitlements).toHaveLength(0);
    expect(after.stories).toHaveLength(0);
    expect(after.storage).toHaveLength(0);
  });

  it("un 404 de Clerk cuenta como borrado: la identidad ya no existía", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_clerk_404");
    await authed.mutation(api.users.upsert, {});

    stubClerkDelete(404);
    await expect(authed.action(api.users.deleteAccount, {})).resolves.toMatchObject({
      status: "ok",
      clerk: "deleted",
    });
  });

  it("requiere sesión", async () => {
    const t = convexTest(schema, modules);
    stubClerkDelete();
    await expect(t.action(api.users.deleteAccount, {})).rejects.toThrow("No autenticado");
  });

  it("es idempotente: una segunda llamada no explota ni borra nada de nadie", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_doble_107");
    const beto = asUser(t, "user_beto_doble");
    const anaId = await ana.mutation(api.users.upsert, {});
    const betoId = await beto.mutation(api.users.upsert, {});
    await seedEverything(t, anaId, "Ana");
    await seedEverything(t, betoId, "Beto");

    stubClerkDelete();
    await ana.action(api.users.deleteAccount, {});
    const second = await ana.action(api.users.deleteAccount, {});

    expect(second.deleted).toEqual({
      messages: 0,
      conversations: 0,
      usage: 0,
      entitlements: 0,
      stories: 0,
      storyImages: 0,
      users: 0,
    });
    const after = await tableDump(t);
    expect(after.users.map((row) => row.clerkId)).toEqual(["user_beto_doble"]);
    expect(after.stories).toHaveLength(1);
  });
});

describe("purgeAccountData", () => {
  it("no toca el contenido editorial global (verses, commentaries, dailyDevotionals)", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_editorial_107");
    const userId = await authed.mutation(api.users.upsert, {});
    await seedEverything(t, userId, "Editorial");

    await t.run(async (ctx) => {
      await ctx.db.insert("verses", {
        book: "Éxodo",
        chapter: 14,
        verse: 21,
        version: "RV1909",
        text: "Y extendió Moisés su mano sobre el mar",
        embedding: Array.from({ length: 1024 }, () => 0),
      });
      await ctx.db.insert("commentaries", {
        source: "Matthew Henry",
        book: "Éxodo",
        chapter: 14,
        text: "comentario",
        embedding: Array.from({ length: 1024 }, () => 0),
      });
      await ctx.db.insert("dailyDevotionals", {
        date: "2026-09-10",
        catalogId: "dev-1",
        verseRef: "Éxodo 14:21",
        reflection: "reflexión",
        imageUrl: "https://example.com/a.jpg",
        imageAlt: "mar",
        imageAttributionUrl: "https://example.com",
      });
    });

    await t.mutation(internal.users.purgeAccountData, { clerkId: "user_editorial_107" });

    const editorial = await t.run(async (ctx) => ({
      verses: await ctx.db.query("verses").collect(),
      commentaries: await ctx.db.query("commentaries").collect(),
      dailyDevotionals: await ctx.db.query("dailyDevotionals").collect(),
    }));
    expect(editorial.verses).toHaveLength(1);
    expect(editorial.commentaries).toHaveLength(1);
    expect(editorial.dailyDevotionals).toHaveLength(1);
  });

  it("con un clerkId inexistente devuelve done sin borrar nada", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.users.purgeAccountData, { clerkId: "user_que_no_existe" }),
    ).resolves.toMatchObject({ done: true, deleted: { users: 0 } });
  });
});
