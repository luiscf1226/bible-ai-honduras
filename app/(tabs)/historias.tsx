import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "convex/react";

import { AppScreen } from "../../src/components/AppScreen";
import { storiesApi, type StoryCatalogItem } from "../../src/features/stories/contracts";
import { tokens } from "../../src/theme/tokens";

export default function HistoriasScreen() {
  const stories = useQuery(storiesApi.stories.list, {});

  return (
    <AppScreen scroll style={styles.screen}>
      <Text style={styles.title}>Historias ilustradas</Text>
      <Text style={styles.subtitle}>Elige una historia bíblica para ver sus escenas ilustradas.</Text>
      {stories === undefined ? <Text style={styles.loading}>Cargando historias…</Text> : <StoryList stories={stories} />}
    </AppScreen>
  );
}

function StoryList({ stories }: { stories: readonly StoryCatalogItem[] }) {
  return (
    <View style={styles.list}>
      {stories.map((story) => (
        <Pressable
          accessibilityHint="Abre los paneles de esta historia"
          accessibilityRole="button"
          key={story.id}
          onPress={() => router.push({ pathname: "/historias/[storyId]", params: { storyId: story.id } })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          testID={`story-catalog-${story.id}`}
        >
          <View accessibilityElementsHidden style={styles.thumbnail} />
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{story.title}</Text>
            <Text style={styles.cardMeta}>{story.reference}</Text>
          </View>
          <Text style={styles.badge}>{story.scenes.length} ESCENAS</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  title: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight
  },
  subtitle: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.sm
  },
  loading: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xxl
  },
  list: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  card: {
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    padding: tokens.space.md
  },
  cardPressed: { backgroundColor: tokens.color.surfaceAlt },
  thumbnail: {
    backgroundColor: tokens.color.surfaceSunk,
    borderRadius: tokens.radius.md,
    height: tokens.size.logoMedium,
    width: tokens.size.logoMedium
  },
  cardCopy: { flex: 1, gap: tokens.space.xs },
  cardTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight
  },
  cardMeta: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight
  },
  badge: {
    backgroundColor: tokens.color.surfaceSunk,
    borderRadius: tokens.radius.pill,
    color: tokens.color.accentDeep,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs
  }
});
