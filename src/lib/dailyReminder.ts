import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const DAILY_REMINDER_CHANNEL = "daily-devotional";
const DAILY_REMINDER_KIND = "daily-devotional";

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

function dailyTrigger(hour: number): Notifications.SchedulableNotificationTriggerInput {
  if (Platform.OS === "ios") {
    return {
      hour,
      minute: 0,
      repeats: true,
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    };
  }

  return {
    channelId: DAILY_REMINDER_CHANNEL,
    hour,
    minute: 0,
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
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

export async function scheduleDailyDevotionalReminder(hour: number): Promise<DailyReminderResult> {
  if (Platform.OS === "web") return "unsupported";
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("La hora del recordatorio debe estar entre 0 y 23.");
  }

  await ensureAndroidChannel();
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return "permission-denied";

  await cancelDailyDevotionalReminder();
  await Notifications.scheduleNotificationAsync({
    content: {
      body: "Tu lectura bíblica diaria está lista para acompañarte.",
      data: { kind: DAILY_REMINDER_KIND, pathname: "/home" },
      title: "Devocional de hoy",
    },
    trigger: dailyTrigger(hour),
  });

  return "scheduled";
}
