import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { DAILY_REMINDER_KIND, DAILY_REMINDER_PATHNAME, reminderRouteFor } from "./reminderRoute";

const DAILY_REMINDER_CHANNEL = "daily-devotional";

/**
 * Un aviso ya armado para una fecha. El texto lo decide `buildReminderContents`
 * (`planReminder.ts`): la lectura de hoy del plan activo (#153) o el
 * versículo del devocional.
 */
export type ScheduledReminder = { date: string; title: string; body: string; planId?: string };

type DailyReminderResult = "scheduled" | "permission-denied" | "unsupported";

function isDailyReminder(notification: Notifications.NotificationRequest) {
  const data = notification.content.data;
  return typeof data === "object" && data !== null && data.kind === DAILY_REMINDER_KIND;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(DAILY_REMINDER_CHANNEL, {
    importance: Notifications.AndroidImportance.DEFAULT,
    name: "Devocional diario",
  });
}

async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

function dateAtReminderHour(date: string, hour: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour);
}

function devotionalTrigger(date: string, hour: number): Notifications.SchedulableNotificationTriggerInput {
  return {
    channelId: DAILY_REMINDER_CHANNEL,
    date: dateAtReminderHour(date, hour),
    type: Notifications.SchedulableTriggerInputTypes.DATE,
  };
}

export function configureDailyReminderNotifications() {
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Tocar el aviso diario abre `/hoy` (#194). Cubre las dos formas de llegar:
 * con la app cerrada (la respuesta queda guardada y se lee al montar) y con la
 * app abierta (listener). Cada respuesta se atiende una sola vez.
 */
export function subscribeToDailyReminderTaps(open: (pathname: string) => void): () => void {
  if (Platform.OS === "web") return () => undefined;

  const handle = (response: Notifications.NotificationResponse | null) => {
    const pathname = reminderRouteFor(response?.notification.request.content.data);
    if (!pathname) return;
    Notifications.clearLastNotificationResponse();
    open(pathname);
  };

  try {
    handle(Notifications.getLastNotificationResponse());
  } catch {
    // Sin respuesta guardada (o módulo no disponible): no hay nada que abrir.
  }
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}

export async function cancelDailyDevotionalReminder() {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(isDailyReminder)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

export async function hasScheduledDailyReminder() {
  if (Platform.OS === "web") return false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(isDailyReminder);
}

/** Si el permiso ya está concedido (no lo pide: sirve para reprogramar en silencio). */
export async function hasNotificationPermission() {
  if (Platform.OS === "web") return false;

  const existing = await Notifications.getPermissionsAsync();
  return existing.granted;
}

export async function scheduleDailyDevotionalReminders(
  hour: number,
  reminders: readonly ScheduledReminder[],
): Promise<DailyReminderResult> {
  if (Platform.OS === "web") return "unsupported";
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("La hora del recordatorio debe estar entre 0 y 23.");
  }
  if (reminders.length === 0) {
    throw new Error("Se necesita al menos un devocional para programar el recordatorio.");
  }

  await ensureAndroidChannel();
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return "permission-denied";

  await cancelDailyDevotionalReminder();
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        body: reminder.body,
        data: {
          date: reminder.date,
          kind: DAILY_REMINDER_KIND,
          pathname: DAILY_REMINDER_PATHNAME,
          ...(reminder.planId ? { planId: reminder.planId } : {}),
        },
        title: reminder.title,
      },
      trigger: devotionalTrigger(reminder.date, hour),
    });
  }

  return "scheduled";
}
