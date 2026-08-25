import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = {
  "./_generated/api.js": () => import("./_generated/api"),
  "./history.ts": () => import("./history"),
  "./users.ts": () => import("./users"),
  "./voicesCatalog.ts": () => import("./voicesCatalog"),
};

function asUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId, issuer: "https://example-dev.clerk.accounts.dev" });
}

async function seedConversation(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  args: {
    module: "qa" | "voices" | "feelings";
    characterId?: string;
    messages: { role: "user" | "assistant"; text: string }[];
  },
) {
  return t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("conversations", {
      userId,
      module: args.module,
      characterId: args.characterId,
      createdAt: Date.now(),
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
    expect(result).toEqual({ deletedConversations: 3, deletedMessages: 4 });

    expect(await authed.query(api.history.list, {})).toEqual([]);
    const leftover = await t.run(async (ctx) => ({
      conversations: await ctx.db.query("conversations").collect(),
      messages: await ctx.db.query("messages").collect(),
    }));
    expect(leftover.conversations).toHaveLength(0);
    expect(leftover.messages).toHaveLength(0);
    expect(leftover.conversations.some((row) => "deleted" in row)).toBe(false);
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
