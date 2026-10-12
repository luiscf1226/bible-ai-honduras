import { describe, expect, it } from "vitest";

import { conversationFilterFrom, conversationTarget, filterConversations } from "./conversations";

const items = [
  { id: "a", module: "qa" as const },
  { id: "b", module: "feelings" as const },
  { id: "c", module: "voices" as const, characterId: "moises" },
];

describe("Mis conversaciones (#232)", () => {
  it("filtra por Preguntar, Sentir y Personajes", () => {
    expect(filterConversations(items, "todo").map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(filterConversations(items, "qa").map((item) => item.id)).toEqual(["a"]);
    expect(filterConversations(items, "feelings").map((item) => item.id)).toEqual(["b"]);
    expect(filterConversations(items, "voices").map((item) => item.id)).toEqual(["c"]);
  });

  it("el filtro de la URL se valida", () => {
    expect(conversationFilterFrom("qa")).toBe("qa");
    expect(conversationFilterFrom(["feelings"])).toBe("feelings");
    expect(conversationFilterFrom("cualquiera")).toBe("todo");
    expect(conversationFilterFrom(undefined)).toBe("todo");
  });

  it("cada conversación abre donde se tuvo", () => {
    expect(conversationTarget(items[0])).toEqual({ kind: "qa", conversationId: "a" });
    expect(conversationTarget(items[1])).toEqual({ kind: "feelings", devotionalId: "b" });
    expect(conversationTarget(items[2])).toEqual({ kind: "voices", slug: "moises" });
    expect(conversationTarget({ id: "d", module: "voices" })).toBeNull();
  });
});
