import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme/tokens";

const times = [
  { label: "Al despertar", value: "6:00" },
  { label: "Al mediodía", value: "12:00" },
  { label: "Antes de dormir", value: "21:00" }
] as const;

export default function NotificationsScreen() {
  const [time, setTime] = useState<(typeof times)[number]["value"]>(times[0].value);
  const finish = () => router.replace("/home");

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.main}>
        <Text style={styles.icon}>◌</Text>
        <Text style={styles.title}>¿A qué hora te lo recordamos?</Text>
        <Text style={styles.description}>Un solo aviso al día con el versículo. Sin insistir, sin notificaciones de más.</Text>
        <View style={styles.timeList}>
          {times.map((option) => {
            const selected = option.value === time;
            return (
              <Pressable accessibilityRole="button" key={option.value} onPress={() => setTime(option.value)} style={[styles.time, selected && styles.timeSelected]}>
                <Text style={[styles.timeValue, selected && styles.timeValueSelected]}>{option.value}</Text>
                <Text style={styles.timeLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton onPress={finish}>Activar el recordatorio</AppButton>
        <AppButton onPress={finish} variant="quiet">Prefiero sin avisos</AppButton>
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
