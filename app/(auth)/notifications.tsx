import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useConvex, useMutation, useQuery } from "convex/react";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { cancelDailyDevotionalReminder, scheduleDailyDevotionalReminders } from "../../src/lib/dailyReminder";
import { upcomingReminderDates } from "../../src/lib/reminderDates";
import { tokens } from "../../src/theme/tokens";
import { api } from "../../convex/_generated/api";

const times = [
  { hour: 6, label: "Al despertar", value: "6:00" },
  { hour: 12, label: "Al mediodía", value: "12:00" },
  { hour: 21, label: "Antes de dormir", value: "21:00" }
] as const;

export default function NotificationsScreen() {
  const convex = useConvex();
  const currentUser = useQuery(api.users.current);
  const todayDevotional = useQuery(api.devotional.today);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [time, setTime] = useState<(typeof times)[number]["value"]>(times[0].value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTime = times.find((option) => option.hour === currentUser?.reminderHour);
    if (savedTime) setTime(savedTime.value);
  }, [currentUser?.reminderHour]);

  const finish = () => router.replace("/home");
  const selectedTime = times.find((option) => option.value === time) ?? times[0];

  const activateReminder = async () => {
    setError(null);
    setIsSaving(true);

    try {
      await updatePreferences({ reminderHour: selectedTime.hour });
      if (!todayDevotional) {
        throw new Error("El devocional de hoy todavía no está disponible.");
      }

      const dates = upcomingReminderDates(selectedTime.hour);
      const devotionals = await Promise.all(
        dates.map(async (date) => {
          if (date === todayDevotional.date) {
            return { date, verseRef: todayDevotional.verseRef };
          }

          const devotional = await convex.query(api.devotional.byDate, { date });
          return { date: devotional.date, verseRef: devotional.verseRef };
        }),
      );
      const result = await scheduleDailyDevotionalReminders(selectedTime.hour, devotionals);

      if (result === "scheduled") {
        finish();
        return;
      }

      setError(
        result === "unsupported"
          ? "Los recordatorios se activan desde la app en tu teléfono."
          : "No autorizaste las notificaciones. Podés activarlas desde los ajustes del teléfono.",
      );
    } catch {
      setError("No pudimos guardar tu recordatorio. Intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const skipReminder = async () => {
    setError(null);
    setIsSaving(true);

    try {
      await cancelDailyDevotionalReminder();
      finish();
    } catch {
      setError("No pudimos desactivar el recordatorio. Intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.main}>
        <Text style={styles.icon}>◌</Text>
        <Text style={styles.title}>¿A qué hora te lo recordamos?</Text>
        <Text style={styles.description}>
          {error ?? "Un solo aviso al día con el versículo. Sin insistir, sin notificaciones de más."}
        </Text>
        <View style={styles.timeList}>
          {times.map((option) => {
            const selected = option.value === time;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isSaving}
                key={option.value}
                onPress={() => setTime(option.value)}
                style={[styles.time, selected && styles.timeSelected]}
              >
                <Text style={[styles.timeValue, selected && styles.timeValueSelected]}>{option.value}</Text>
                <Text style={styles.timeLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton disabled={isSaving || !todayDevotional} onPress={activateReminder} testID="activate-daily-reminder">
          {isSaving ? "Guardando…" : "Activar el recordatorio"}
        </AppButton>
        <AppButton disabled={isSaving} onPress={skipReminder} variant="quiet">
          Prefiero sin avisos
        </AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "space-between" },
  main: { flex: 1, justifyContent: "center" },
  icon: { color: tokens.color.accent, fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xxl },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg },
  timeList: { flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.xxl },
  time: { alignItems: "center", backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.lg, borderWidth: 1, flex: 1, paddingVertical: tokens.space.lg },
  timeSelected: { backgroundColor: tokens.color.surfaceSunk, borderColor: tokens.color.accent },
  timeValue: { color: tokens.color.inkMuted, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  timeValueSelected: { color: tokens.color.ink },
  timeLabel: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs, textAlign: "center" },
  actions: { gap: tokens.space.sm }
});
