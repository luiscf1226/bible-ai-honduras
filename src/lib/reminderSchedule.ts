import type { ConvexReactClient } from "convex/react";

import { api } from "../../convex/_generated/api";
import {
  hasNotificationPermission,
  hasScheduledDailyReminder,
  scheduleDailyDevotionalReminders,
  type ScheduledReminder,
} from "./dailyReminder";
import { buildReminderContents } from "./planReminder";
import { upcomingReminderDates } from "./reminderDates";

/**
 * Arma los avisos de la ventana de `upcomingReminderDates`: trae el versículo
 * de cada fecha y los planes empezados, y deja que `buildReminderContents`
 * decida qué dice cada uno (#153).
 */
export async function loadDailyReminders(
  convex: ConvexReactClient,
  hour: number,
  knownDevotional?: { date: string; verseRef: string },
): Promise<ScheduledReminder[]> {
  const dates = upcomingReminderDates(hour);
  const [devotionals, candidates] = await Promise.all([
    Promise.all(
      dates.map(async (date) => {
        if (knownDevotional && date === knownDevotional.date) return knownDevotional;
        const devotional = await convex.query(api.devotional.byDate, { date });
        return { date: devotional.date, verseRef: devotional.verseRef };
      }),
    ),
    convex.query(api.readingPlans.reminderCandidates, { dates }),
  ]);
  return buildReminderContents(devotionals, candidates);
}

/**
 * Reprograma los avisos en silencio cuando cambia algo que afecta su texto
 * (empezar un plan o marcar un día). Solo si el usuario ya tenía el
 * recordatorio activo y el permiso concedido: nunca pide permiso ni activa
 * avisos que el usuario no pidió. Los errores se tragan — el aviso anterior
 * sigue programado y no vale la pena interrumpir la lectura por esto.
 */
export async function refreshDailyRemindersIfActive(convex: ConvexReactClient): Promise<void> {
  try {
    if (!(await hasScheduledDailyReminder()) || !(await hasNotificationPermission())) return;
    const user = await convex.query(api.users.current, {});
    const hour = user?.reminderHour;
    if (hour === undefined || hour === null) return;
    await scheduleDailyDevotionalReminders(hour, await loadDailyReminders(convex, hour));
  } catch {
    // Ver comentario de arriba: best-effort.
  }
}
