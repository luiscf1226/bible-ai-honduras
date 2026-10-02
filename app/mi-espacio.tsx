import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppScreen } from "../src/components/AppScreen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { buildMySpaceSections, type MySpaceDestination } from "../src/features/personal/mySpaceSections";
import { yearInWordEntry } from "../src/features/personal/yearInWord";
import { PRIVACY_POLICY_URL } from "../src/lib/legalLinks";
import { openPassage } from "../src/lib/openPassage";
import { hondurasToday } from "../src/lib/reminderDates";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

function go(destination: MySpaceDestination) {
  if (destination.kind === "passage") {
    openPassage(destination.passage);
    return;
  }
  if (destination.kind === "sentir") {
    router.push(destination.openHistory ? { pathname: "/sentir", params: { historial: "1" } } : "/sentir");
    return;
  }
  router.push(destination.href);
}

/**
 * Mi espacio (#169): todo lo personal en un solo lugar, con la misma tarjeta y
 * renglón de Ajustes. Cada renglón lleva a la pantalla que ya existe.
 */
export default function MiEspacioScreen() {
  const { color } = useTheme();
  const separator = useQuery(api.reading.separator, {});
  const bookmarks = useQuery(api.reading.bookmarks, {});
  const highlights = useQuery(api.reading.highlights, {});
  const history = useQuery(api.history.list, {});
  const loading = separator === undefined || bookmarks === undefined || highlights === undefined || history === undefined;

  // "Tu año en la Palabra" (#183): solo del 1 de diciembre al 31 de enero.
  const yearEntry = yearInWordEntry(hondurasToday());

  const sections = buildMySpaceSections({
    separator: separator ?? null,
    bookmarks: bookmarks?.items ?? [],
    highlights: highlights ?? [],
    history: history ?? [],
  });

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader accessibilityLabel="Volver" style={styles.header} title="Mi espacio" />

      <View style={[styles.card, { backgroundColor: color.surfaceSunk, borderColor: color.border }]} testID="mi-espacio-privacidad">
        <Text style={[styles.privacyCopy, { color: color.inkMuted }]}>
          Solo vos ves esto. Se guarda en tu cuenta y se borra si eliminás la cuenta.
        </Text>
        <Pressable
          accessibilityHint="Abre la política en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          style={[styles.row, styles.rowDivider, { borderTopColor: color.border }]}
          testID="mi-espacio-politica-privacidad"
        >
          <Text style={[styles.rowLabel, { color: color.ink }]}>Política de privacidad</Text>
          <Text style={[styles.chevron, { color: color.inkFaint }]}>↗</Text>
        </Pressable>
      </View>

      {yearEntry ? (
        <View style={[styles.card, styles.sections, { backgroundColor: color.surface, borderColor: color.border }]}>
          <Pressable
            accessibilityHint="Abre el resumen de tu año."
            accessibilityRole="button"
            onPress={() => router.push("/tu-ano")}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID="mi-espacio-tu-ano"
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: color.ink }]}>{yearEntry.title}</Text>
              <Text style={[styles.rowHint, { color: color.inkSoft }]}>{yearEntry.hint}</Text>
            </View>
            <Text style={[styles.action, { color: color.accentDeep }]}>Abrir ›</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.card, styles.sections, { backgroundColor: color.surface, borderColor: color.border }]}>
        {sections.map((section, index) => (
          <Pressable
            accessibilityHint={section.count > 0 ? `Abre ${section.title.toLowerCase()}.` : undefined}
            accessibilityLabel={`${section.title}, ${section.count}`}
            accessibilityRole="button"
            disabled={loading}
            key={section.id}
            onPress={() => go(section.destination)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowDivider,
              index > 0 && { borderTopColor: color.border },
              pressed && styles.pressed,
            ]}
            testID={`mi-espacio-${section.id}`}
          >
            <View style={styles.rowText}>
              <View style={styles.titleLine}>
                <Text style={[styles.rowLabel, { color: color.ink }]}>{section.title}</Text>
                <Text style={[styles.count, { color: section.count > 0 ? color.accent : color.inkFaint }]}>
                  {loading ? "…" : section.count}
                </Text>
              </View>
              <Text
                numberOfLines={section.count > 0 ? 1 : undefined}
                style={[section.count > 0 ? styles.latest : styles.rowHint, { color: section.count > 0 ? color.inkMuted : color.inkSoft }]}
              >
                {section.detail}
              </Text>
            </View>
            <Text style={[styles.action, { color: section.count > 0 ? color.accentDeep : color.inkSoft }]}>
              {section.action} ›
            </Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  sections: { marginTop: tokens.space.xxl },
  privacyCopy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  titleLine: { alignItems: "baseline", flexDirection: "row", gap: tokens.space.sm },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  count: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  // Lo último de la sección es una referencia o un título: va en serif, como
  // los versículos guardados de Leer.
  latest: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  action: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  chevron: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
});
