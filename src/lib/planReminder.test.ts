import { describe, expect, it } from "vitest";

import { buildReminderContents, pickReminderPlan, reminderContent, type ReminderPlanCandidate } from "./planReminder";

const DATE = "2026-10-03";

function candidate(overrides: Partial<ReminderPlanCandidate> & Pick<ReminderPlanCandidate, "planId">): ReminderPlanCandidate {
  return {
    planName: overrides.planId,
    totalDays: 365,
    completedCount: 0,
    lastActivityAt: 1_000,
    days: [{ date: DATE, day: 4, completed: false, readings: [{ book: "Génesis", chapter: 4 }] }],
    ...overrides,
  };
}

const beginner = candidate({
  planId: "anual-para-empezar",
  planName: "La Biblia en un año · para empezar",
  lastActivityAt: 2_000,
  days: [
    {
      date: DATE,
      day: 3,
      completed: false,
      readings: [
        { book: "Génesis", chapter: 4 },
        { book: "Génesis", chapter: 5 },
        { book: "Mateo", chapter: 3 },
        { book: "Salmos", chapter: 3 },
      ],
    },
  ],
});

describe("pickReminderPlan", () => {
  it("sin planes no hay plan que mencionar", () => {
    expect(pickReminderPlan([], DATE)).toBeNull();
  });

  it("con varios planes activos gana el abierto más recientemente, no el primero del catálogo", () => {
    const canonical = candidate({ planId: "canonico", lastActivityAt: 1_000 });
    const anxiety = candidate({ planId: "ansiedad", lastActivityAt: 3_000, totalDays: 7 });

    expect(pickReminderPlan([canonical, beginner, anxiety], DATE)?.planId).toBe("ansiedad");
    expect(pickReminderPlan([canonical, beginner], DATE)?.planId).toBe("anual-para-empezar");
  });

  it("entre los dos anuales elige por actividad, sin importar el orden en que llegan", () => {
    const canonical = candidate({ planId: "canonico", lastActivityAt: 5_000 });
    expect(pickReminderPlan([canonical, beginner], DATE)?.planId).toBe("canonico");
    expect(pickReminderPlan([beginner, canonical], DATE)?.planId).toBe("canonico");
  });

  it("en un empate de actividad gana el primero en orden de catálogo", () => {
    const canonical = candidate({ planId: "canonico", lastActivityAt: 2_000 });
    expect(pickReminderPlan([canonical, beginner], DATE)?.planId).toBe("canonico");
  });

  it("un recorrido que ya terminó ese día deja el aviso al anual", () => {
    const finishedJourney = candidate({ planId: "ansiedad", lastActivityAt: 9_000, totalDays: 7, days: [] });
    expect(pickReminderPlan([beginner, finishedJourney], DATE)?.planId).toBe("anual-para-empezar");
  });

  it("descarta un plan con todos los días marcados", () => {
    const done = candidate({ planId: "ansiedad", lastActivityAt: 9_000, totalDays: 7, completedCount: 7 });
    expect(pickReminderPlan([beginner, done], DATE)?.planId).toBe("anual-para-empezar");
  });

  it("descarta el día que ya se marcó por adelantado", () => {
    const readAhead = candidate({
      planId: "ansiedad",
      lastActivityAt: 9_000,
      days: [{ date: DATE, day: 2, completed: true, readings: [{ book: "Filipenses", chapter: 4 }] }],
    });
    expect(pickReminderPlan([beginner, readAhead], DATE)?.planId).toBe("anual-para-empezar");
    expect(pickReminderPlan([readAhead], DATE)).toBeNull();
  });

  it("devuelve las lecturas de la fecha pedida, no las de otra", () => {
    const twoDays = candidate({
      planId: "canonico",
      days: [
        { date: "2026-10-02", day: 1, completed: false, readings: [{ book: "Génesis", chapter: 1 }] },
        { date: DATE, day: 2, completed: false, readings: [{ book: "Génesis", chapter: 2 }] },
      ],
    });
    expect(pickReminderPlan([twoDays], DATE)?.readings).toEqual([{ book: "Génesis", chapter: 2 }]);
  });
});

describe("reminderContent", () => {
  it("sin plan sigue con el versículo del día, igual que antes", () => {
    expect(reminderContent("Salmos 23:1", null)).toEqual({
      title: "Devocional de hoy",
      body: "Lectura de hoy: Salmos 23:1.",
    });
  });

  it("con plan menciona la lectura de hoy", () => {
    const content = reminderContent("Salmos 23:1", pickReminderPlan([beginner], DATE));
    expect(content).toEqual({
      title: "Tu lectura de hoy · La Biblia en un año · para empezar",
      body: "Hoy: Génesis 4-5, Mateo 3, Salmos 3.",
      planId: "anual-para-empezar",
    });
  });

  it("muestra los pasajes de un recorrido con sus versículos", () => {
    const content = reminderContent("Salmos 23:1", {
      planId: "ansiedad",
      planName: "Ansiedad",
      readings: [{ book: "Mateo", chapter: 6, verseStart: 25, verseEnd: 34 }],
    });
    expect(content.body).toBe("Hoy: Mateo 6:25-34.");
  });

  it("no culpabiliza: nada de atrasos ni pendientes", () => {
    const content = reminderContent("Salmos 23:1", pickReminderPlan([beginner], DATE));
    const text = `${content.title} ${content.body}`.toLowerCase();
    for (const word of ["atras", "pendiente", "perdiste", "todavía no", "ponete al día", "racha"]) {
      expect(text).not.toContain(word);
    }
  });
});

describe("buildReminderContents", () => {
  it("cada fecha usa su plan, y vuelve al versículo cuando no hay plan ese día", () => {
    const journey = candidate({
      planId: "ansiedad",
      planName: "Ansiedad",
      lastActivityAt: 9_000,
      totalDays: 7,
      days: [{ date: "2026-10-02", day: 7, completed: false, readings: [{ book: "Salmos", chapter: 46 }] }],
    });

    const contents = buildReminderContents(
      [
        { date: "2026-10-02", verseRef: "Juan 3:16" },
        { date: DATE, verseRef: "Salmos 23:1" },
      ],
      [journey],
    );

    expect(contents).toEqual([
      { date: "2026-10-02", title: "Tu lectura de hoy · Ansiedad", body: "Hoy: Salmos 46.", planId: "ansiedad" },
      { date: DATE, title: "Devocional de hoy", body: "Lectura de hoy: Salmos 23:1." },
    ]);
  });
});
