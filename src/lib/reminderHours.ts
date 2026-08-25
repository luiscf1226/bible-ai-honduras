export const REMINDER_HOURS = [
  { display: "6:00", hour: 6, label: "Al despertar" },
  { display: "12:00", hour: 12, label: "Al mediodía" },
  { display: "21:00", hour: 21, label: "Antes de dormir" },
] as const;

export type ReminderHour = (typeof REMINDER_HOURS)[number]["hour"];
export type ReminderDisplay = (typeof REMINDER_HOURS)[number]["display"];

export function reminderHourFromDisplay(display: ReminderDisplay): ReminderHour {
  const match = REMINDER_HOURS.find((option) => option.display === display);
  return match?.hour ?? 6;
}
