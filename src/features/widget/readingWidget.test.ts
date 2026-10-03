import { describe, expect, it } from "vitest";

import {
  pickWidgetPlan,
  READING_WIDGET_DONE,
  READING_WIDGET_NO_DATA,
  READING_WIDGET_NO_PLAN,
  READING_WIDGET_PLAN_URL,
  READING_WIDGET_TITLE,
  readingDayFor,
  readingWidgetDays,
  readingWidgetProps,
  readingWidgetTimeline,
  streakOn,
  upcomingDates,
  type PlanCandidate,
  type ReadingWidgetDay,
} from "./readingWidget";
import { WIDGET_BRAND, WIDGET_PALETTE } from "./verseWidget";

const anual: PlanCandidate = {
  planId: "biblia-en-un-ano",
  planName: "La Biblia en un año",
  totalDays: 365,
  completedCount: 10,
  lastActivityAt: 100,
  days: [
    { date: "2026-10-02", day: 12, completed: false, readings: [{ book: "Génesis", chapter: 4 }, { book: "Génesis", chapter: 5 }] },
    { date: "2026-10-03", day: 13, completed: false, readings: [{ book: "Génesis", chapter: 6 }] },
  ],
};

const ansiedad: PlanCandidate = {
  planId: "ansiedad",
  planName: "Cuando la ansiedad aprieta",
  totalDays: 7,
  completedCount: 2,
  lastActivityAt: 200,
  days: [{ date: "2026-10-02", day: 3, completed: true, readings: [{ book: "Mateo", chapter: 6, verseStart: 25, verseEnd: 34 }] }],
};

describe("widget \"Tu lectura de hoy\" (#184)", () => {
  it("elige el plan abierto más recientemente, aunque ese día ya esté leído", () => {
    expect(pickWidgetPlan([anual, ansiedad], "2026-10-02")?.candidate.planId).toBe("ansiedad");
    expect(pickWidgetPlan([anual, ansiedad], "2026-10-03")?.candidate.planId).toBe("biblia-en-un-ano");
    expect(pickWidgetPlan([{ ...ansiedad, completedCount: 7 }], "2026-10-02")).toBeNull();
    expect(pickWidgetPlan([], "2026-10-02")).toBeNull();
  });

  it("muestra la racha solo si sigue viva ese día", () => {
    const streak = { planId: "x", currentStreak: 5, lastCompletedDate: "2026-10-01" };
    expect(streakOn(streak, "2026-10-01")).toBe(5);
    expect(streakOn(streak, "2026-10-02")).toBe(5);
    expect(streakOn(streak, "2026-10-03")).toBe(0);
    expect(streakOn({ planId: "x", currentStreak: 3 }, "2026-10-02")).toBe(0);
    expect(streakOn(undefined, "2026-10-02")).toBe(0);
  });

  it("arma un día por fecha, con la lectura de hoy, la racha y sin plan cuando no hay", () => {
    const dates = upcomingDates("2026-10-02", 3);
    expect(dates).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    const days = readingWidgetDays([anual], [{ planId: anual.planId, currentStreak: 4, lastCompletedDate: "2026-10-01" }], dates);
    expect(days[0]).toMatchObject({ kind: "reading", readingsLabel: "Génesis 4-5", day: 12, streak: 4, completed: false });
    expect(days[1]).toMatchObject({ kind: "reading", readingsLabel: "Génesis 6", streak: 0 });
    expect(days[2]).toEqual({ date: "2026-10-04", kind: "noPlan" });
    expect(upcomingDates("2026-12-31", 2)).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it("solo usa el día exacto: una lectura de ayer no se muestra como la de hoy", () => {
    const days = readingWidgetDays([anual], [], ["2026-10-02"]);
    expect(readingDayFor(days, "2026-10-02")?.date).toBe("2026-10-02");
    expect(readingDayFor(days, "2026-10-03")).toBeNull();
  });

  it("pinta la lectura, el día del plan, la racha y abre el plan", () => {
    const [today] = readingWidgetDays([anual], [{ planId: anual.planId, currentStreak: 1, lastCompletedDate: "2026-10-02" }], ["2026-10-02"]);
    const props = readingWidgetProps(today, { locked: false });
    expect(props).toMatchObject({
      title: "La Biblia en un año",
      headline: "Génesis 4-5",
      detail: "Día 12 de 365",
      footer: "Racha: 1 día",
      inline: "Hoy: Génesis 4-5",
      hasReading: true,
      url: "bibleai://leer/plan?planId=biblia-en-un-ano",
    });
    expect(props.palette).toBe(WIDGET_PALETTE);

    const [done] = readingWidgetDays([ansiedad], [], ["2026-10-02"]);
    const doneProps = readingWidgetProps(done, { locked: false });
    expect(doneProps.detail).toBe(READING_WIDGET_DONE);
    expect(doneProps.headline).toBe("Mateo 6:25-34");
    expect(doneProps.footer).toBe(WIDGET_BRAND);
  });

  it("recorta lecturas y nombres largos en palabra completa", () => {
    const long: ReadingWidgetDay = {
      date: "2026-10-02",
      kind: "reading",
      planId: "p",
      planName: "Un recorrido con un nombre larguísimo de verdad",
      day: 1,
      totalDays: 7,
      readingsLabel: "1 Crónicas 1-9, Mateo 26:1-75, Salmos 119:1-176, Proverbios 30, Lamentaciones 1-5",
      completed: false,
      streak: 0,
    };
    const props = readingWidgetProps(long, { locked: false });
    expect(props.headline.endsWith("…")).toBe(true);
    expect(props.headline.length).toBeLessThanOrEqual(61);
    expect(props.title.endsWith("…")).toBe(true);
    expect(props.title.length).toBeLessThanOrEqual(29);
    expect(props.inline.length).toBeLessThanOrEqual(33);
  });

  it("sin plan invita a elegir uno; sin datos de hoy (o sin conexión) pide abrir la app", () => {
    expect(readingWidgetProps({ date: "2026-10-02", kind: "noPlan" }, { locked: false })).toMatchObject({
      headline: READING_WIDGET_NO_PLAN,
      hasReading: false,
      url: READING_WIDGET_PLAN_URL,
    });
    expect(readingWidgetProps(null, { locked: false })).toMatchObject({
      title: READING_WIDGET_TITLE,
      headline: READING_WIDGET_NO_DATA,
      inline: READING_WIDGET_TITLE,
    });
  });

  it("con el bloqueo de #171 no muestra plan, lectura ni racha", () => {
    const [today] = readingWidgetDays([anual], [{ planId: anual.planId, currentStreak: 9, lastCompletedDate: "2026-10-02" }], ["2026-10-02"]);
    const props = readingWidgetProps(today, { locked: true });
    const visible = [props.title, props.headline, props.detail, props.footer, props.inline, props.url].join(" ");
    expect(visible).not.toContain("Génesis");
    expect(visible).not.toContain("Biblia en un año");
    expect(visible).not.toContain("Racha");
    expect(visible).not.toContain("biblia-en-un-ano");
    expect(props.hasReading).toBe(false);

    const timeline = readingWidgetTimeline(readingWidgetDays([anual], [], ["2026-10-02", "2026-10-03"]), { locked: true }, Date.UTC(2026, 9, 2, 15));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].props.headline).toBe(READING_WIDGET_NO_DATA);
  });

  it("arma la línea de tiempo de iOS: hoy ya, cada día a su medianoche y al final el aviso", () => {
    const now = Date.UTC(2026, 9, 2, 15);
    const days = readingWidgetDays([anual], [], ["2026-10-01", "2026-10-02", "2026-10-03"]);
    const entries = readingWidgetTimeline(days, { locked: false }, now);
    expect(entries.map((entry) => entry.props.headline)).toEqual(["Génesis 4-5", "Génesis 6", READING_WIDGET_NO_DATA]);
    expect(entries[0].date.getTime()).toBe(now);
    expect(entries[1].date.toISOString()).toBe("2026-10-03T06:00:00.000Z");
    expect(entries[2].date.toISOString()).toBe("2026-10-04T06:00:00.000Z");

    expect(readingWidgetTimeline([], { locked: false }, now).map((entry) => entry.props.headline)).toEqual([READING_WIDGET_NO_DATA]);
  });
});
