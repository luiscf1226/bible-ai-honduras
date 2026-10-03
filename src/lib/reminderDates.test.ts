import { describe, expect, it } from "vitest";

import { hondurasToday, REMINDER_WINDOW_DAYS, upcomingReminderDates } from "./reminderDates";

describe("upcomingReminderDates", () => {
  it("usa la fecha de Honduras y conserva hoy mientras la hora todavía no pasó", () => {
    const dates = upcomingReminderDates(6, new Date(Date.UTC(2026, 0, 1, 11, 59)), 3);

    expect(dates).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("empieza mañana cuando la hora elegida ya pasó", () => {
    const dates = upcomingReminderDates(6, new Date(Date.UTC(2026, 0, 1, 12)), 3);

    expect(dates).toEqual(["2026-01-02", "2026-01-03", "2026-01-04"]);
  });

  it("cubre la ventana editorial completa por defecto", () => {
    expect(upcomingReminderDates(21, new Date(Date.UTC(2026, 0, 1, 18)))).toHaveLength(REMINDER_WINDOW_DAYS);
  });
});

describe("hondurasToday", () => {
  it("usa el calendario de Honduras (UTC-6), no el UTC", () => {
    // 1 dic 2026 05:00 UTC = 30 nov 23:00 en Honduras.
    expect(hondurasToday(new Date(Date.UTC(2026, 11, 1, 5)))).toBe("2026-11-30");
    expect(hondurasToday(new Date(Date.UTC(2026, 11, 1, 6)))).toBe("2026-12-01");
  });
});
