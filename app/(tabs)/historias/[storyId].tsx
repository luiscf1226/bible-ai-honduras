import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";

import { AppButton } from "../../../src/components/AppButton";
import { AppScreen } from "../../../src/components/AppScreen";
import { StoryViewer } from "../../../src/features/stories/StoryPanels";
import { storiesApi } from "../../../src/features/stories/contracts";
import { buildStoryShareText } from "../../../src/features/stories/storyShare";
import { shareContent } from "../../../src/lib/share";
import { tokens } from "../../../src/theme/tokens";
import { api } from "../../../convex/_generated/api";

export default function StoryViewerScreen() {
  const { storyId } = useLocalSearchParams<{ storyId?: string | string[] }>();
  const selectedStoryId = Array.isArray(storyId) ? storyId[0] : storyId;
  const story = useQuery(storiesApi.stories.getById, selectedStoryId ? { storyId: selectedStoryId } : "skip");
  const currentUser = useQuery(api.users.current);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!selectedStoryId) {
    return <ViewerState detail="No recibimos una historia para mostrar." title="Historia no encontrada" />;
  }

  if (story === undefined) {
    return <ViewerState detail="Estamos preparando los paneles de esta historia." title="Cargando historia…" />;
  }

  if (story === null) {
    return <ViewerState detail="Esta historia no está disponible en el catálogo." title="Historia no encontrada" />;
  }

  const referralCode = currentUser?.referralCode;
  const canShare = Boolean(referralCode) && !isSharing;
  const shareLabel = isSharing
    ? "Abriendo opciones…"
    : currentUser === undefined
      ? "Preparando enlace…"
      : referralCode
        ? "Compartir la historia"
        : "Inicia sesión para compartir";

  const shareStory = async () => {
    if (!referralCode) return;

    setShareError(null);
    setIsSharing(true);
    try {
      await shareContent({ referralCode, text: buildStoryShareText(story) });
    } catch {
      setShareError("No pudimos abrir las opciones de compartir. Intentá de nuevo.");
    } finally {
      setIsSharing(false);
    }
  };

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
      <StoryViewer story={story} />
      <Pressable
        accessibilityHint="Abre las opciones para compartir esta historia, incluido WhatsApp"
        accessibilityRole="button"
        accessibilityState={{ disabled: !canShare }}
        disabled={!canShare}
        onPress={shareStory}
        style={({ pressed }) => [
          styles.shareButton,
          !canShare && styles.shareButtonDisabled,
          pressed && canShare && styles.shareButtonPressed,
        ]}
        testID="share-story"
      >
        <Text style={styles.shareLabel}>{shareLabel}</Text>
      </Pressable>
      {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}
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
  stateContent: { justifyContent: "space-between" },
  stateCopy: { flex: 1, justifyContent: "center" },
  detail: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg
  },
  shareButton: {
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: tokens.space.xxl,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.lg
  },
  shareButtonPressed: { backgroundColor: tokens.color.surfaceAlt },
  shareButtonDisabled: { opacity: tokens.type.caption.size / tokens.type.label.size },
  shareLabel: {
    color: tokens.color.ink,
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight
  },
  shareError: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.sm,
    textAlign: "center"
  }
});
