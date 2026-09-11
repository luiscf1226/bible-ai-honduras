import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { voiceCharacters } from "../convex/voicesCatalog";
import { AppScreen } from "../src/components/AppScreen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

function hondurasDay(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date(timestamp));
}

function relativeWhen(createdAt: number) {
  const today = hondurasDay(Date.now());
  const day = hondurasDay(createdAt);
  if (day === today) {
    return "Hoy";
  }
  const yesterday = hondurasDay(Date.now() - 24 * 60 * 60 * 1000);
  if (day === yesterday) {
    return "Ayer";
  }
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    timeZone: "America/Tegucigalpa",
  }).format(new Date(createdAt));
}

export default function HistorialScreen() {
  const { color } = useTheme();
  const items = useQuery(api.history.list);

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader
        accessibilityLabel="Volver"
        style={styles.header}
        title="Mis conversaciones"
      />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>Solo tú las ves. Se guardan en tu cuenta.</Text>

      {(items ?? []).length > 0 ? (
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        {(items ?? []).map((item, index) => {
          const character = voiceCharacters.find((entry) => entry.slug === item.characterId);
          return (
            <View
              key={item.id}
              style={[
                styles.row,
                index > 0 && styles.rowDivider,
                index > 0 && { borderTopColor: color.border },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: character ? character.gradientFrom : color.surfaceSunk },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: character ? color.surface : color.accent }]}>
                  {item.initial}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.itemTitle, { color: color.ink }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.preview, { color: color.inkSoft }]} numberOfLines={1}>
                  {item.preview}
                </Text>
              </View>
              <Text style={[styles.when, { color: color.inkFaint }]}>{relativeWhen(item.createdAt)}</Text>
            </View>
          );
        })}
      </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.sm },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginBottom: tokens.space.xxl,
    marginLeft: tokens.size.dotActive + tokens.space.md + tokens.space.md,
  },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", flexDirection: "row", gap: tokens.space.lg, paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowDivider: { borderTopWidth: 1 },
  avatar: { alignItems: "center", borderRadius: tokens.radius.pill, height: tokens.size.logoSmall, justifyContent: "center", width: tokens.size.logoSmall },
  avatarInitial: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  rowText: { flex: 1, minWidth: 0 },
  itemTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.subtitle.lineHeight },
  preview: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  when: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size },
});
