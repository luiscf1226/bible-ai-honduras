import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { cancelDailyDevotionalReminder, scheduleDailyDevotionalReminder } from "../../src/lib/dailyReminder";
import { REMINDER_HOURS, reminderHourFromDisplay, type ReminderDisplay } from "../../src/lib/reminderHours";
import { tokens } from "../../src/theme/tokens";

export default function NotificationsScreen() {
  const currentUser = useQuery(api.users.current);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [time, setTime] = useState<ReminderDisplay>(REMINDER_HOURS[0].display);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTime = REMINDER_HOURS.find((option) => option.hour === currentUser?.reminderHour);
    if (savedTime) setTime(savedTime.display);
  }, [currentUser?.reminderHour]);

  const finish = () => router.replace("/home");
  const selectedTime = reminderHourFromDisplay(time);

  const activateReminder = async () => {
    setError(null);
    setIsSaving(true);

    try {
      await updatePreferences({ reminderHour: selectedTime });
      const result = await scheduleDailyDevotionalReminder(selectedTime);

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
          {REMINDER_HOURS.map((option) => {
            const selected = option.display === time;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isSaving}
                key={option.display}
                onPress={() => setTime(option.display)}
                style={[styles.time, selected && styles.timeSelected]}
              >
                <Text style={[styles.timeValue, selected && styles.timeValueSelected]}>{option.display}</Text>
                <Text style={styles.timeLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton disabled={isSaving} onPress={activateReminder} testID="activate-daily-reminder">
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
