import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./history.ts": () => import("./history"),
  "./memorize.ts": () => import("./memorize"),
  "./prayers.ts": () => import("./prayers"),
  "./reading.ts": () => import("./reading"),
  "./bibleVersions.ts": () => import("./bibleVersions"),
  "./users.ts": () => import("./users"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

const getHistoryConversation = makeFunctionReference<"query", { conversationId: Id<"conversations"> }, unknown>(
  "history:getById",
);

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function seedConversation(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  args: {
    module: "qa" | "voices" | "feelings";
    characterId?: string;
    title?: string;
    updatedAt?: number;
    messages: { role: "user" | "assistant"; text: string }[];
  },
) {
  return t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      module: args.module,
      characterId: args.characterId,
      createdAt: Date.now(),
      title: args.title,
      updatedAt: args.updatedAt,
    });
    for (const message of args.messages) {
      await ctx.db.insert("messages", {
        conversationId,
        role: message.role,
        text: message.text,
      });
    }
    return conversationId;
  });
}

describe("history.list", () => {
  it("devuelve solo las conversaciones del usuario autenticado", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, "user_alice_h");
    const bob = asUser(t, "user_bob_h");
    const aliceId = await alice.mutation(api.users.upsert, {});
    const bobId = await bob.mutation(api.users.upsert, {});

    await seedConversation(t, aliceId, {
      module: "voices",
      characterId: "moises",
      messages: [
        { role: "user", text: "¿Cómo cruzaste el mar?" },
        { role: "assistant", text: "El camino se abrió mientras caminaba." },
      ],
    });
    await seedConversation(t, bobId, {
      module: "qa",
      messages: [{ role: "user", text: "pregunta de Bob" }],
    });

    const list = await alice.query(api.history.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      title: "Moisés",
      preview: "El camino se abrió mientras caminaba.",
      module: "voices",
    });
  });
});

describe("history.list — Preguntar con una conversación por tema (#191)", () => {
  it("lista cada conversación qa con su título, la de actividad más reciente primero", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_qa_topics_h");
    const anaId = await ana.mutation(api.users.upsert, {});

    await seedConversation(t, anaId, {
      module: "qa",
      messages: [{ role: "user", text: "pregunta de antes" }],
    });
    await seedConversation(t, anaId, {
      module: "qa",
      title: "Génesis 1",
      updatedAt: Date.now() + 1_000,
      messages: [{ role: "user", text: "¿Qué pasó en la creación?" }],
    });
    await seedConversation(t, anaId, {
      module: "qa",
      title: "Romanos 8",
      updatedAt: Date.now() + 2_000,
      messages: [{ role: "user", text: "¿No hay condenación?" }],
    });

    const list = await ana.query(api.history.list, {});
    expect(list.map((item) => item.title)).toEqual(["Romanos 8", "Génesis 1", "Pregunta al texto"]);
    expect(list.every((item) => item.module === "qa")).toBe(true);

    const result = await ana.mutation(api.history.deleteAll, {});
    expect(result.deletedConversations).toBe(3);
    expect(await ana.query(api.history.list, {})).toEqual([]);
  });
});

describe("history.getById", () => {
  it("devuelve el detalle propio y no revela el de otro usuario", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, "user_alice_detail");
    const bob = asUser(t, "user_bob_detail");
    const aliceId = await alice.mutation(api.users.upsert, {});
    await bob.mutation(api.users.upsert, {});
    const conversationId = await seedConversation(t, aliceId, {
      module: "feelings",
      messages: [{ role: "assistant", text: "Dios cuida de vos." }],
    });

    await expect(alice.query(getHistoryConversation, { conversationId })).resolves.toMatchObject({
      module: "feelings",
      messages: [{ text: "Dios cuida de vos." }],
    });
    await expect(bob.query(getHistoryConversation, { conversationId })).resolves.toBeNull();
  });
});

describe("history.deleteAll", () => {
  it("borra de verdad las filas, no deja deleted:true", async () => {
    const t = convexTest(schema, modules);
    const authed = asUser(t, "user_wipe");
    const userId = await authed.mutation(api.users.upsert, {});

    await seedConversation(t, userId, {
      module: "qa",
      messages: [
        { role: "user", text: "¿Qué significa el valle?" },
        { role: "assistant", text: "Un desfiladero oscuro." },
      ],
    });
    await seedConversation(t, userId, {
      module: "voices",
      characterId: "ester",
      messages: [{ role: "assistant", text: "El valor no me llegó de golpe." }],
    });
    await seedConversation(t, userId, {
      module: "feelings",
      messages: [{ role: "user", text: "ansiedad" }],
    });

    const result = await authed.mutation(api.history.deleteAll, {});
    expect(result).toEqual({ deletedConversations: 3, deletedMessages: 4, deletedPrayers: 0, clearedNotes: 0 });

    expect(await authed.query(api.history.list, {})).toEqual([]);
    const leftover = await t.run(async (ctx) => ({
      conversations: await ctx.db.query("conversations").collect(),
      messages: await ctx.db.query("messages").collect(),
    }));
    expect(leftover.conversations).toHaveLength(0);
    expect(leftover.messages).toHaveLength(0);
    expect(leftover.conversations.some((row) => "deleted" in row)).toBe(false);
  });

  it("borra las notas de los guardados pero deja los versículos guardados (#167)", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_notes_wipe");
    const beto = asUser(t, "user_notes_other");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});

    await ana.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "Lo predicó el pastor" });
    await ana.mutation(api.reading.toggleBookmark, { book: "Salmos", chapter: 23, verse: 1 });
    await beto.mutation(api.reading.setBookmarkNote, { book: "Juan", chapter: 3, verse: 16, note: "De Beto" });

    const result = await ana.mutation(api.history.deleteAll, {});
    expect(result.clearedNotes).toBe(1);

    const anaSaved = await ana.query(api.reading.bookmarks, {});
    expect(anaSaved.total).toBe(2);
    expect(anaSaved.items.every((item) => item.note === null)).toBe(true);
    const betoSaved = await beto.query(api.reading.bookmarks, {});
    expect(betoSaved.items[0]?.note).toBe("De Beto");
  });

  it("borra las peticiones de oración pero deja los versículos de Memorizar (#159/#158)", async () => {
    const t = convexTest(schema, modules);
    const ana = asUser(t, "user_prayers_wipe");
    const beto = asUser(t, "user_prayers_other");
    await ana.mutation(api.users.upsert, {});
    await beto.mutation(api.users.upsert, {});

    const answered = await ana.mutation(api.prayers.create, { text: "Por el trabajo de mi papá" });
    await ana.mutation(api.prayers.markAnswered, { id: answered, note: "Lo contrataron" });
    await ana.mutation(api.prayers.create, { text: "Por la salud de mi abuela" });
    await ana.mutation(api.memorize.add, { book: "Salmos", chapter: 23, verse: 1 });
    await beto.mutation(api.prayers.create, { text: "De Beto" });

    const result = await ana.mutation(api.history.deleteAll, {});
    expect(result.deletedPrayers).toBe(2);

    expect(await ana.query(api.prayers.list, {})).toEqual([]);
    expect((await ana.query(api.memorize.list, {})).items).toHaveLength(1);
    const betoPrayers = await beto.query(api.prayers.list, {});
    expect(betoPrayers.map((item) => item.text)).toEqual(["De Beto"]);
  });

  it("no borra el historial de otro usuario", async () => {
    const t = convexTest(schema, modules);
    const alice = asUser(t, "user_alice_wipe");
    const bob = asUser(t, "user_bob_wipe");
    const aliceId = await alice.mutation(api.users.upsert, {});
    const bobId = await bob.mutation(api.users.upsert, {});

    await seedConversation(t, aliceId, {
      module: "qa",
      messages: [{ role: "user", text: "de Alice" }],
    });
    await seedConversation(t, bobId, {
      module: "qa",
      messages: [{ role: "user", text: "de Bob" }],
    });

    await alice.mutation(api.history.deleteAll, {});

    expect(await alice.query(api.history.list, {})).toEqual([]);
    const bobList = await bob.query(api.history.list, {});
    expect(bobList).toHaveLength(1);
    expect(bobList[0].preview).toBe("de Bob");
  });

  it("requiere sesión", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.history.deleteAll, {})).rejects.toThrow("No autenticado");
  });
});
