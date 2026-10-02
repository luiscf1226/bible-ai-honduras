import { describe, expect, it } from "vitest";

import { DAILY_REMINDER_KIND, reminderRouteFor } from "./reminderRoute";

describe("reminderRouteFor (#194)", () => {
  it("el aviso diario abre /hoy", () => {
    expect(reminderRouteFor({ date: "2026-10-02", kind: DAILY_REMINDER_KIND, pathname: "/hoy" })).toBe("/hoy");
  });

  it("los avisos programados antes del cambio (pathname /home) también abren /hoy", () => {
    expect(reminderRouteFor({ date: "2026-10-02", kind: DAILY_REMINDER_KIND, pathname: "/home" })).toBe("/hoy");
  });

  it("ignora otras notificaciones y datos vacíos", () => {
    expect(reminderRouteFor({ kind: "otra-cosa", pathname: "/ajustes" })).toBeNull();
    expect(reminderRouteFor(null)).toBeNull();
    expect(reminderRouteFor(undefined)).toBeNull();
    expect(reminderRouteFor("daily-devotional")).toBeNull();
  });
});
