import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { AppButton } from "../../../src/components/AppButton";
import { AppScreen } from "../../../src/components/AppScreen";
import { StoryViewer } from "../../../src/features/stories/StoryPanels";
import { shareStory } from "../../../src/features/stories/storyShare";
import { storiesApi } from "../../../src/features/stories/contracts";
import { tokens } from "../../../src/theme/tokens";

export default function StoryViewerScreen() {
  const { storyId } = useLocalSearchParams<{ storyId?: string | string[] }>();
  const selectedStoryId = Array.isArray(storyId) ? storyId[0] : storyId;
  const story = useQuery(storiesApi.stories.getById, selectedStoryId ? { storyId: selectedStoryId } : "skip");
  const generated = useQuery(storiesApi.stories.latestForViewer, selectedStoryId ? { storyId: selectedStoryId } : "skip");
  const currentUser = useQuery(api.users.current);

  if (!selectedStoryId) {
    return <ViewerState detail="No recibimos una historia para mostrar." title="Historia no encontrada" />;
  }

  if (story === undefined) {
    return <ViewerState detail="Estamos preparando los paneles de esta historia." title="Cargando historia…" />;
  }

  if (story === null) {
    return <ViewerState detail="Esta historia no está disponible en el catálogo." title="Historia no encontrada" />;
  }

  return (
    <AppScreen scroll style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Volver a historias"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{story.title}</Text>
      </View>
      <Pressable
        accessibilityHint={
          currentUser?.referralCode
            ? "Abre las opciones para compartir esta historia."
            : "Esperá mientras cargamos tu perfil."
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: !currentUser?.referralCode }}
        disabled={!currentUser?.referralCode}
        onPress={() => {
          if (!currentUser?.referralCode) {
            return;
          }
          void shareStory({ referralCode: currentUser.referralCode, story });
        }}
        style={styles.share}
        testID="historias-share-story"
      >
        <Text style={styles.shareIcon}>↗</Text>
        <Text style={styles.shareLabel}>Compartir esta historia</Text>
      </Pressable>
      <StoryViewer images={Object.fromEntries((generated?.scenes ?? []).map((scene) => [scene.id, scene.status === "ready" && scene.uri ? { status: "ready", uri: scene.uri } : scene.status === "generating" ? { status: "generating" } : { status: "unavailable" }]))} story={story} />
    </AppScreen>
  );
}

function ViewerState({ detail, title }: { detail: string; title: string }) {
  return (
    <AppScreen contentStyle={styles.stateContent} style={styles.screen}>
      <View style={styles.stateCopy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <AppButton onPress={() => router.replace("/historias")} variant="secondary">
        Volver a historias
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surfaceAlt },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, marginBottom: tokens.space.xl },
  backButton: {
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    padding: tokens.space.sm
  },
  backButtonPressed: { backgroundColor: tokens.color.surfaceAlt },
  backIcon: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight
  },
  title: {
    color: tokens.color.ink,
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight
  },
  share: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: tokens.space.sm,
    marginBottom: tokens.space.lg
  },
  shareIcon: {
    color: tokens.color.accent,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight
  },
  shareLabel: {
    color: tokens.color.accent,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight
  },
  stateContent: { justifyContent: "space-between" },
  stateCopy: { flex: 1, justifyContent: "center" },
  detail: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg
  }
});
