import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => push(...args) } }));

import { PREGUNTAR_ROUTE, chatRouteParams, goToChat, readChatParams } from "./goToChat";

beforeEach(() => push.mockReset());

describe("goToChat", () => {
  it("desde el lector: abre Preguntar con el versículo precargado", () => {
    goToChat({ book: "Juan", chapter: 3, verse: 16 });
    expect(push).toHaveBeenCalledWith({
      pathname: PREGUNTAR_ROUTE,
      params: { book: "Juan", chapter: "3", verse: "16" },
    });
  });

  it("desde Sentir y /hoy: la cita del devocional llega al chip", () => {
    goToChat({ book: "Mateo", chapter: 11, verse: 28 });
    const [{ params }] = push.mock.calls[0];
    expect(readChatParams(params).passage).toEqual({ book: "Mateo", chapter: 11, verse: 28 });
  });

  it("sin pasaje abre Preguntar en blanco (tema nuevo)", () => {
    goToChat({});
    expect(push).toHaveBeenCalledWith({ pathname: PREGUNTAR_ROUTE, params: {} });
  });

  it("Preguntar es la pantalla principal, no /preguntar/chat", () => {
    expect(PREGUNTAR_ROUTE).toBe("/preguntar");
  });
});

describe("chatRouteParams", () => {
  it("capítulo sin versículo", () => {
    expect(chatRouteParams({ book: "Romanos", chapter: 8 })).toEqual({ book: "Romanos", chapter: "8" });
  });

  it("retoma una conversación", () => {
    expect(chatRouteParams({ conversationId: "c1" })).toEqual({ conversationId: "c1" });
  });

  it("un libro sin capítulo no se manda", () => {
    expect(chatRouteParams({ book: "Juan" })).toEqual({});
  });

  it("la pregunta del inicio viaja recortada; vacía no se manda", () => {
    expect(chatRouteParams({ pregunta: "  ¿Qué es la gracia?  " })).toEqual({ pregunta: "¿Qué es la gracia?" });
    expect(chatRouteParams({ pregunta: "   " })).toEqual({});
  });
});

describe("readChatParams", () => {
  it("es el inverso de chatRouteParams", () => {
    const input = { book: "Salmos", chapter: 46, verse: 1, conversationId: "c9", pregunta: "¿Qué es amparo?" };
    expect(readChatParams(chatRouteParams(input))).toEqual({
      passage: { book: "Salmos", chapter: 46, verse: 1 },
      conversationId: "c9",
      pregunta: "¿Qué es amparo?",
    });
  });

  it("sin params: sin pasaje, sin conversación, campo vacío", () => {
    expect(readChatParams({})).toEqual({ passage: null, conversationId: undefined, pregunta: "" });
  });

  it("normaliza el nombre del libro (deep link escrito a mano)", () => {
    expect(readChatParams({ book: "genesis", chapter: "1" }).passage).toEqual({ book: "Génesis", chapter: 1 });
  });

  it("descarta un pasaje roto en vez de mostrar “Jaun NaN”", () => {
    expect(readChatParams({ book: "Jaun", chapter: "3" }).passage).toBeNull();
    expect(readChatParams({ book: "Juan", chapter: "x" }).passage).toBeNull();
    expect(readChatParams({ book: "Juan", chapter: "0" }).passage).toBeNull();
    expect(readChatParams({ book: "Juan", chapter: "22" }).passage).toBeNull();
  });

  it("un versículo inválido se ignora pero el capítulo queda", () => {
    expect(readChatParams({ book: "Juan", chapter: "3", verse: "abc" }).passage).toEqual({ book: "Juan", chapter: 3 });
  });

  it("acepta params repetidos (expo-router puede mandar arrays)", () => {
    expect(readChatParams({ book: ["Juan", "Mateo"], chapter: ["3"] }).passage).toEqual({ book: "Juan", chapter: 3 });
  });
});
