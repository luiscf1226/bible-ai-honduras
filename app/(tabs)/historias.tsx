import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import { AppScreen } from "../../src/components/AppScreen";
import { storiesApi, type StoryCatalogItem } from "../../src/features/stories/contracts";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

export default function HistoriasScreen() {
  const { color } = useTheme();
  const stories = useQuery(storiesApi.stories.list, {});
  const create = useMutation(storiesApi.stories.create);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <AppScreen scroll>
      <Text style={[styles.title, { color: color.ink }]}>Historias ilustradas</Text>
      <Text style={[styles.subtitle, { color: color.inkMuted }]}>
        Elige una historia bíblica para ver sus escenas ilustradas.
      </Text>
      {error ? <Text style={[styles.error, { color: color.accentDeep }]}>{error}</Text> : null}
      {stories === undefined ? (
        <Text style={[styles.loading, { color: color.inkSoft }]}>Cargando historias…</Text>
      ) : (
        <StoryList
          color={color}
          creating={creating}
          create={create}
          setCreating={setCreating}
          setError={setError}
          stories={stories}
        />
      )}
    </AppScreen>
  );
}

function StoryList({
  color,
  creating,
  create,
  setCreating,
  setError,
  stories,
}: {
  color: ReturnType<typeof useTheme>["color"];
  creating: string | null;
  create: ReturnType<typeof useMutation>;
  setCreating: (storyId: string | null) => void;
  setError: (error: string | null) => void;
  stories: readonly StoryCatalogItem[];
}) {
  return (
    <View style={styles.list}>
      {stories.map((story) => (
        <Pressable
          accessibilityHint="Abre los paneles de esta historia"
          accessibilityRole="button"
          key={story.id}
          disabled={creating !== null}
          onPress={() =>
            void (async () => {
              setError(null);
              setCreating(story.id);
              try {
                const result = await create({ storyId: story.id });
                if (!result.allowed) {
                  router.push("/paywall");
                  return;
                }
                router.push({ pathname: "/historias/[storyId]", params: { storyId: story.id } });
              } catch {
                setError("No pudimos preparar esta historia. Intentá de nuevo.");
              } finally {
                setCreating(null);
              }
            })()
          }
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: color.surface, borderColor: color.border },
            pressed && { backgroundColor: color.surfaceAlt },
          ]}
          testID={`story-catalog-${story.id}`}
        >
          <View accessibilityElementsHidden style={[styles.thumbnail, { backgroundColor: color.surfaceSunk }]} />
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: color.ink }]}>{story.title}</Text>
            <Text style={[styles.cardMeta, { color: color.inkSoft }]}>{story.reference}</Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: color.surfaceSunk, color: color.accentDeep }]}>
            {creating === story.id ? "DIBUJANDO…" : `${story.scenes.length} ESCENAS`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
  },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.sm,
  },
  loading: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xxl,
  },
  error: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.lg,
  },
  list: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  card: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    padding: tokens.space.md,
  },
  thumbnail: {
    borderRadius: tokens.radius.md,
    height: tokens.size.logoMedium,
    width: tokens.size.logoMedium,
  },
  cardCopy: { flex: 1, gap: tokens.space.xs },
  cardTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  cardMeta: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs,
  },
});
