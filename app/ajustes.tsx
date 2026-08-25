import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppScreen } from "../src/components/AppScreen";
import { tokens } from "../src/theme/tokens";

const VERSIONS = [
  { label: "RVR1960", value: "RVR1960" as const },
  { label: "NVI", value: "NVI" as const },
];

// Esqueleto (issue #34): versión bíblica + modo oscuro. La sección de
// recordatorio espera a #10 (push diaria) y "Mis conversaciones"/borrar
// historial es #35 — ninguna de las dos se construye acá.
export default function AjustesScreen() {
  const user = useQuery(api.users.current);
  const updatePreferences = useMutation(api.users.updatePreferences);

  return (
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Ajustes</Text>
      </View>

      <Text style={styles.sectionLabel}>Lectura</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Versión de la Biblia</Text>
          <View style={styles.versionPicker}>
            {VERSIONS.map((version) => {
              const active = user?.bibleVersion === version.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={version.value}
                  onPress={() => updatePreferences({ bibleVersion: version.value })}
                  style={[styles.versionPill, active && styles.versionPillActive]}
                >
                  <Text style={[styles.versionPillLabel, active && styles.versionPillLabelActive]}>{version.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Modo noche suave</Text>
            <Text style={styles.rowHint}>Para el devocional antes de dormir</Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: user?.darkMode ?? false }}
            onPress={() => updatePreferences({ darkMode: !(user?.darkMode ?? false) })}
            style={[styles.switchTrack, user?.darkMode && styles.switchTrackActive]}
          >
            <View style={[styles.switchKnob, user?.darkMode && styles.switchKnobActive]} />
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: 0 },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, marginBottom: tokens.space.xxl },
  backButton: { alignItems: "center", borderColor: tokens.color.border, borderRadius: tokens.radius.pill, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  backIcon: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  sectionLabel: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, marginBottom: tokens.space.md },
  card: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowDivider: { borderTopColor: tokens.color.border, borderTopWidth: 1 },
  rowText: { flex: 1 },
  rowLabel: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.label.size },
  rowHint: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  versionPicker: { flexDirection: "row", gap: tokens.space.xs },
  versionPill: { borderColor: tokens.color.border, borderRadius: tokens.radius.sm, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  versionPillActive: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
  versionPillLabel: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  versionPillLabelActive: { color: tokens.color.surface },
  switchTrack: { backgroundColor: tokens.color.border, borderRadius: tokens.radius.pill, height: 28, justifyContent: "center", padding: 3, width: 46 },
  switchTrackActive: { backgroundColor: tokens.color.sage },
  switchKnob: { backgroundColor: tokens.color.surface, borderRadius: tokens.radius.pill, height: 22, width: 22 },
  switchKnobActive: { transform: [{ translateX: 18 }] }
});
