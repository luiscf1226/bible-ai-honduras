import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppScreen } from "../src/components/AppScreen";
import { REMINDER_HOURS } from "../src/lib/reminderHours";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

const VERSIONS = [
  { label: "RVR1960", value: "RVR1960" as const },
  { label: "NVI", value: "NVI" as const },
];

export default function AjustesScreen() {
  const { color } = useTheme();
  const user = useQuery(api.users.current);
  const entitlement = useQuery(api.entitlements.mine);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const isPro = entitlement?.isPro === true;
  const bibleVersion = user?.bibleVersion ?? "RVR1960";
  const darkMode = user?.darkMode ?? false;

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: color.border }]}
        >
          <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: color.ink }]}>Ajustes</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/paywall")}
        style={[
          styles.planCard,
          { backgroundColor: isPro ? color.surfaceSunk : color.ink },
        ]}
        testID="ajustes-plan"
      >
        <View style={styles.planText}>
          <Text style={[styles.planTitle, { color: isPro ? color.ink : color.surface }]}>
            {isPro ? "Pro activo" : "Plan gratis"}
          </Text>
          <Text style={[styles.planSub, { color: isPro ? color.inkSoft : color.inkFaint }]}>
            {isPro ? "Sin límites de preguntas ni conversaciones" : "3 preguntas y 2 devocionales al día"}
          </Text>
        </View>
        <Text style={[styles.planChevron, { color: color.accent }]}>›</Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Lectura</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <View style={styles.versionBlock}>
          <Text style={[styles.rowLabel, { color: color.ink }]}>Versión de la Biblia</Text>
          <View style={styles.versionPicker}>
            {VERSIONS.map((version) => {
              const active = bibleVersion === version.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={version.value}
                  onPress={() => updatePreferences({ bibleVersion: version.value })}
                  style={[
                    styles.versionPill,
                    {
                      backgroundColor: active ? color.surfaceSunk : color.surface,
                      borderColor: active ? color.borderStrong : color.border,
                    },
                  ]}
                  testID={`ajustes-version-${version.value}`}
                >
                  <Text style={[styles.versionPillLabel, { color: active ? color.ink : color.inkSoft }]}>
                    {version.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: color.ink }]}>Modo noche suave</Text>
            <Text style={[styles.rowHint, { color: color.inkSoft }]}>Para el devocional antes de dormir</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: darkMode }}
            onPress={() => updatePreferences({ darkMode: !darkMode })}
            style={[styles.switchTrack, { backgroundColor: darkMode ? color.sage : color.border }]}
            testID="ajustes-dark-mode"
          >
            <View
              style={[
                styles.switchKnob,
                { backgroundColor: color.surface },
                darkMode && styles.switchKnobActive,
              ]}
            />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Recordatorio</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: color.ink }]}>Aviso del versículo</Text>
          <View style={styles.hourPicker}>
            {REMINDER_HOURS.map((option) => {
              const active = user?.reminderHour === option.hour;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.hour}
                  onPress={() => updatePreferences({ reminderHour: option.hour })}
                  style={[
                    styles.hourPill,
                    {
                      backgroundColor: active ? color.surfaceSunk : color.surface,
                      borderColor: active ? color.borderStrong : color.border,
                    },
                  ]}
                  testID={`ajustes-hour-${option.hour}`}
                >
                  <Text style={[styles.hourPillLabel, { color: active ? color.ink : color.inkSoft }]}>
                    {option.display}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, marginBottom: tokens.space.xxl },
  backButton: { alignItems: "center", borderRadius: tokens.radius.pill, borderWidth: 1, height: tokens.size.dotActive + tokens.space.md, justifyContent: "center", width: tokens.size.dotActive + tokens.space.md },
  backIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  planCard: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    flexDirection: "row",
    gap: tokens.space.md,
    justifyContent: "space-between",
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl,
  },
  planText: { flex: 1 },
  planTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  planSub: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  planChevron: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  sectionLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    marginBottom: tokens.space.md,
    marginTop: tokens.space.xxl + tokens.space.xs,
    textTransform: "uppercase",
  },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  versionBlock: { paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  versionPicker: { flexDirection: "row", gap: tokens.space.sm, marginTop: tokens.space.lg },
  versionPill: { borderRadius: tokens.radius.sm, borderWidth: 1, flex: 1, paddingVertical: tokens.space.md },
  versionPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, textAlign: "center" },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  hourPicker: { flexDirection: "row", gap: tokens.space.xs },
  hourPill: { borderRadius: tokens.radius.sm, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  hourPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  switchTrack: { borderRadius: tokens.radius.pill, height: 28, justifyContent: "center", padding: 3, width: 46 },
  switchKnob: { borderRadius: tokens.radius.pill, height: 22, width: 22 },
  switchKnobActive: { transform: [{ translateX: 18 }] },
});
