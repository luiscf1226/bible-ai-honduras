import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppScreen } from "../src/components/AppScreen";
import { DEFAULT_BIBLE_VERSION, bibleVersionIsAvailable } from "../convex/bibleVersions";
import { REMINDER_HOURS } from "../src/lib/reminderHours";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

// #93 §4b: NVI sigue en la lista para no romper el layout de dos píldoras del
// prototipo, pero va deshabilitada — no hay corpus ingerido y la licencia sigue
// sin resolver (PRD §6). `bibleVersionIsAvailable` es la única fuente de verdad.
const VERSIONS = [
  { label: "RV1909", value: "RV1909" as const },
  { label: "RVR1960", value: "RVR1960" as const },
];

const PRIVACY_POLICY_URL = "https://luiscf1226.github.io/bible-ai-honduras/privacidad/";

export default function AjustesScreen() {
  const { color } = useTheme();
  const user = useQuery(api.users.current);
  const entitlement = useQuery(api.entitlements.mine);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const deleteHistory = useMutation(api.history.deleteAll);
  const [cleared, setCleared] = useState(false);
  const isPro = entitlement?.isPro === true;
  // Una preferencia guardada que ya no está disponible (NVI) se muestra como
  // RVR1960, que es lo que el backend usa de verdad al recuperar.
  const storedVersion = user?.bibleVersion ?? DEFAULT_BIBLE_VERSION;
  const bibleVersion = bibleVersionIsAvailable(storedVersion) ? storedVersion : DEFAULT_BIBLE_VERSION;
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
              const available = bibleVersionIsAvailable(version.value);
              const active = available && bibleVersion === version.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !available, selected: active }}
                  disabled={!available}
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
          <Text style={[styles.versionHint, { color: color.inkSoft }]} testID="ajustes-version-hint">
            RVR1960 y NVI todavía no están disponibles: son de licencia comercial.
          </Text>
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/historial")}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-historial"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Mis conversaciones</Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>›</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Privacidad</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Text style={[styles.privacyCopy, { color: color.inkMuted }]}>
          Tus conversaciones son privadas. Compartimos con proveedores de IA solo lo necesario para responderte.
        </Text>
        <Pressable
          accessibilityHint="Abre la política en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-politica-privacidad"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Política de privacidad</Text>
          <Text style={[styles.planChevron, { color: color.inkFaint }]}>↗</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={cleared}
          onPress={() => {
            Alert.alert(
              "¿Borrar tu historial?",
              "Se eliminan de verdad tus conversaciones. No se puede deshacer.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: () => {
                    void deleteHistory({}).then(() => setCleared(true));
                  },
                },
              ],
            );
          }}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="ajustes-borrar-historial"
        >
          <Text style={[styles.rowLabel, { color: cleared ? color.inkSoft : color.danger }]}>
            {cleared ? "Historial borrado" : "Borrar mi historial"}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.disclaimer, { color: color.inkFaint }]}>
        Esta app acompaña tu lectura; no sustituye el consejo pastoral. La IA puede cometer errores.
      </Text>
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
  versionHint: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.sm,
  },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  hourPicker: { flexDirection: "row", gap: tokens.space.xs },
  hourPill: { borderRadius: tokens.radius.sm, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  hourPillLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  switchTrack: {
    borderRadius: tokens.radius.pill,
    height: tokens.size.switchTrack.height,
    justifyContent: "center",
    padding: tokens.size.switchPadding,
    width: tokens.size.switchTrack.width,
  },
  switchKnob: { borderRadius: tokens.radius.pill, height: tokens.size.switchKnob, width: tokens.size.switchKnob },
  switchKnobActive: { transform: [{ translateX: tokens.size.switchKnobOffset }] },
  privacyCopy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  disclaimer: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xxl,
    textAlign: "center",
  },
});
