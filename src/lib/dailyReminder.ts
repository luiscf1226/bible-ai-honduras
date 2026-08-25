import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const DAILY_REMINDER_CHANNEL = "daily-devotional";
const DAILY_REMINDER_KIND = "daily-devotional";

export type ScheduledDevotional = { date: string; verseRef: string };

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

export async function cancelDailyDevotionalReminder() {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(isDailyReminder)
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

export async function scheduleDailyDevotionalReminders(
  hour: number,
  devotionals: readonly ScheduledDevotional[],
): Promise<DailyReminderResult> {
  if (Platform.OS === "web") return "unsupported";
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("La hora del recordatorio debe estar entre 0 y 23.");
  }
  if (devotionals.length === 0) {
    throw new Error("Se necesita al menos un devocional para programar el recordatorio.");
  }

  await ensureAndroidChannel();
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return "permission-denied";

  await cancelDailyDevotionalReminder();
  for (const devotional of devotionals) {
    await Notifications.scheduleNotificationAsync({
      content: {
        body: `Lectura de hoy: ${devotional.verseRef}.`,
        data: { date: devotional.date, kind: DAILY_REMINDER_KIND, pathname: "/home" },
        title: "Devocional de hoy",
      },
      trigger: devotionalTrigger(devotional.date, hour),
    });
  }

  return "scheduled";
}
