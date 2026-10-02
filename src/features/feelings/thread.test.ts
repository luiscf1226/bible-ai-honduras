import { describe, expect, it } from "vitest";

import { buildFeelingQuestion } from "../../../convex/feelings";
import {
  INITIAL_THREAD,
  bottomSlotFor,
  canSend,
  feelingsLabel,
  quotaLabel,
  showFollowUps,
  threadReducer,
  toggleFeeling,
  turnsFromHistory,
  userTurnFromStored,
  withFeeling,
  type FeelingDevotional,
  type ThreadState,
} from "./thread";

const DEVOTIONAL: FeelingDevotional = {
  title: "Para la ansiedad",
  reflection: "No tenés que cargarlo solo.",
  prayer: "Señor, dame tu paz. Amén.",
  citation: { book: "Filipenses", chapter: 4, verse: 6, version: "RV1909", text: "Por nada estéis afanosos…" },
};

function sentAndAnswered(): ThreadState {
  const sent = threadReducer(INITIAL_THREAD, { type: "sent", id: "u1", feelings: ["Ansiedad"], note: " no duermo " });
  return threadReducer(sent, { type: "generated", id: "d1", devotional: DEVOTIONAL });
}

describe("threadReducer", () => {
  it("enviar agrega el mensaje del usuario, esconde el composer y queda esperando", () => {
    const state = threadReducer(INITIAL_THREAD, { type: "sent", id: "u1", feelings: ["Ansiedad"], note: " no duermo " });
    expect(state.turns).toEqual([{ kind: "user", id: "u1", feelings: ["Ansiedad"], note: "no duermo" }]);
    expect(state.pending).toEqual({ feelings: ["Ansiedad"], note: " no duermo " });
    expect(bottomSlotFor(state, false)).toBe("none");
  });

  it("el devocional llega como mensaje con los sentimientos que se pidieron", () => {
    const state = sentAndAnswered();
    expect(state.turns.at(-1)).toEqual({ kind: "devotional", id: "d1", devotional: DEVOTIONAL, feelings: ["Ansiedad"] });
    expect(state.pending).toBeNull();
    // Sin chat libre: después del devocional no hay composer, solo los chips.
    expect(bottomSlotFor(state, false)).toBe("none");
    expect(showFollowUps(state, 1)).toBe(true);
    expect(showFollowUps(state, 0)).toBe(false);
  });

  it("un devocional sin envío pendiente se ignora (respuesta vieja)", () => {
    expect(threadReducer(INITIAL_THREAD, { type: "generated", id: "d1", devotional: DEVOTIONAL })).toBe(INITIAL_THREAD);
  });

  it("'Otro devocional' vuelve a mostrar el composer y esconde los chips", () => {
    const state = threadReducer(sentAndAnswered(), { type: "anotherRequested" });
    expect(bottomSlotFor(state, false)).toBe("composer");
    expect(showFollowUps(state, 1)).toBe(false);
    expect(state.turns).toHaveLength(2);
  });

  it("si falla, se saca el mensaje sin respuesta y vuelve el composer con el error", () => {
    const sent = threadReducer(INITIAL_THREAD, { type: "sent", id: "u1", feelings: ["Miedo"], note: "" });
    const state = threadReducer(sent, { type: "failed", message: "Sin conexión" });
    expect(state.turns).toEqual([]);
    expect(state.error).toBe("Sin conexión");
    expect(bottomSlotFor(state, false)).toBe("composer");
  });

  it("en el límite el hilo queda y el composer se cambia por el aviso", () => {
    const answered = threadReducer(sentAndAnswered(), { type: "anotherRequested" });
    const sent = threadReducer(answered, { type: "sent", id: "u2", feelings: ["Duelo"], note: "" });
    const state = threadReducer(sent, { type: "limitReached" });
    expect(state.turns.map((turn) => turn.id)).toEqual(["u1", "d1"]);
    expect(bottomSlotFor(state, true)).toBe("limit");
    expect(bottomSlotFor(INITIAL_THREAD, true)).toBe("limit");
  });

  it("abrir uno de 'Los de antes' reemplaza el hilo sin generar, y 'Nuevo devocional' lo limpia", () => {
    const opened = threadReducer(INITIAL_THREAD, {
      type: "historyOpened",
      turns: turnsFromHistory("c1", [
        { role: "user", text: "Cansancio" },
        { role: "assistant", text: "…", devotional: DEVOTIONAL },
      ]),
    });
    expect(opened.turns).toHaveLength(2);
    expect(opened.pending).toBeNull();
    expect(showFollowUps(opened, 1)).toBe(true);
    expect(threadReducer(opened, { type: "reset" })).toBe(INITIAL_THREAD);
  });
});

describe("composer", () => {
  it("se puede enviar con chips, con texto o con ambos", () => {
    expect(canSend([], "")).toBe(false);
    expect(canSend([], "   ")).toBe(false);
    expect(canSend(["Ansiedad"], "")).toBe(true);
    expect(canSend([], "me mudé")).toBe(true);
  });

  it("los chips son multi-selección y el param no duplica", () => {
    expect(toggleFeeling(["Ansiedad"], "Miedo")).toEqual(["Ansiedad", "Miedo"]);
    expect(toggleFeeling(["Ansiedad", "Miedo"], "Ansiedad")).toEqual(["Miedo"]);
    expect(withFeeling(["Ansiedad"], "Ansiedad")).toEqual(["Ansiedad"]);
    expect(withFeeling([], "Gratitud")).toEqual(["Gratitud"]);
  });

  it("etiquetas de chips y de cuota", () => {
    expect(feelingsLabel(["Ansiedad", "Cansancio"])).toBe("Ansiedad · Cansancio");
    expect(quotaLabel({ isPro: false, remaining: 2, limit: 3 })).toBe("2 de 3 devocionales gratis hoy");
    expect(quotaLabel({ isPro: false, remaining: 1, limit: 1 })).toBe("1 de 1 devocional gratis hoy");
    expect(quotaLabel({ isPro: true, remaining: 3, limit: 3 })).toBe("Pro · sin límite");
    expect(quotaLabel(undefined)).toBeNull();
  });
});

describe("userTurnFromStored", () => {
  it("recupera chips y nota del prompt que guarda el servidor", () => {
    const stored = buildFeelingQuestion({ feelings: ["Ansiedad", "Cansancio"], note: "No duermo, pienso en las deudas." });
    expect(userTurnFromStored("m1", stored)).toEqual({
      kind: "user",
      id: "m1",
      feelings: ["Ansiedad", "Cansancio"],
      note: "No duermo, pienso en las deudas.",
    });
  });

  it("solo chips, o solo nota", () => {
    expect(userTurnFromStored("m1", buildFeelingQuestion({ feelings: ["Duelo"] })).feelings).toEqual(["Duelo"]);
    expect(userTurnFromStored("m1", buildFeelingQuestion({ feelings: ["Duelo"] })).note).toBe("");
    expect(userTurnFromStored("m1", buildFeelingQuestion({ feelings: [], note: "Me siento solo" }))).toMatchObject({
      feelings: [],
      note: "Me siento solo",
    });
  });

  it("un texto que no es el prompt se muestra tal cual", () => {
    expect(userTurnFromStored("m1", "Cansancio")).toEqual({ kind: "user", id: "m1", feelings: [], note: "Cansancio" });
  });

  it("el devocional de 'Los de antes' hereda los sentimientos del mensaje anterior", () => {
    const turns = turnsFromHistory("c1", [
      { role: "user", text: buildFeelingQuestion({ feelings: ["Miedo"] }) },
      { role: "assistant", text: "…", devotional: DEVOTIONAL },
    ]);
    expect(turns[1]).toMatchObject({ kind: "devotional", feelings: ["Miedo"] });
  });
});
