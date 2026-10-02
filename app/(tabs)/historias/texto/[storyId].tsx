import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { AppButton } from "../../../../src/components/AppButton";
import { AppScreen } from "../../../../src/components/AppScreen";
import { LoadingState } from "../../../../src/components/LoadingState";
import { ScreenHeader } from "../../../../src/components/ScreenHeader";
import type { TextStoryCatalogItem } from "../../../../convex/textStoriesCatalog";
import { goToChat } from "../../../../src/lib/goToChat";
import { goToVoices } from "../../../../src/lib/goToVoices";
import { openPassage } from "../../../../src/lib/openPassage";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { tokens } from "../../../../src/theme/tokens";
import { RequiresConnection } from "../../../../src/features/offline/RequiresConnection";

const getTextStory = makeFunctionReference<"query", { storyId: string }, TextStoryCatalogItem | null>(
  "textStories:getById",
);

/**
 * Visor de historia en texto (#145). Gratis: no consulta cuotas ni paywall.
 * Páginas tipográficas + puentes a lector, Preguntar y Voces.
 */
function TextStoryViewerScreenContent() {
  const { color } = useTheme();
  const { storyId } = useLocalSearchParams<{ storyId?: string | string[] }>();
  const selectedStoryId = Array.isArray(storyId) ? storyId[0] : storyId;
  const [pageIndex, setPageIndex] = useState(0);
  const [viewerEpoch, setViewerEpoch] = useState(0);
  const storyArgs =
    selectedStoryId && viewerEpoch >= 0 ? { storyId: selectedStoryId } : ("skip" as const);
  const story = useQuery(getTextStory, storyArgs);

  const retry = () => {
    setViewerEpoch(-1);
    requestAnimationFrame(() => setViewerEpoch((value) => (value < 0 ? 0 : value + 1)));
  };

  if (!selectedStoryId) {
    return <StateCard detail="No recibimos una historia para mostrar." title="Historia no encontrada" />;
  }

  if (story === undefined || viewerEpoch < 0) {
    return (
      <AppScreen contentStyle={styles.stateContent} style={{ backgroundColor: color.surfaceAlt }}>
        <LoadingState
          detail="Estamos abriendo las páginas de esta historia."
          message="Cargando historia…"
          onRetry={retry}
          testID="historias-text-loading"
        />
      </AppScreen>
    );
  }

  if (story === null) {
    return <StateCard detail="Esta historia no está en el catálogo de texto." title="Historia no encontrada" />;
  }

  const page = story.pages[pageIndex] ?? story.pages[0];
  const isLast = pageIndex >= story.pages.length - 1;

  return (
    <AppScreen scroll style={{ backgroundColor: color.surfaceAlt }}>
      <ScreenHeader
        accessibilityLabel="Volver a historias"
        onBack={() => router.back()}
        style={styles.header}
        testID="historias-text-back"
        title={story.title}
        titleStyle={styles.title}
      />
      <Text style={[styles.reference, { color: color.inkMuted }]}>{story.reference} · Basado en RV1909</Text>
      <Text style={[styles.pageLabel, { color: color.accent }]}>
        PÁGINA {pageIndex + 1} DE {story.pages.length}
      </Text>
      <Text style={[styles.body, { color: color.ink }]} testID="historias-text-page">
        {page}
      </Text>

      <View style={styles.pager}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pageIndex === 0 }}
          disabled={pageIndex === 0}
          onPress={() => setPageIndex((value) => Math.max(0, value - 1))}
          style={({ pressed }) => [
            styles.pagerButton,
            { borderColor: color.border, backgroundColor: color.surface },
            pageIndex === 0 && { opacity: tokens.opacity.pressed },
            pressed && { opacity: tokens.opacity.pressed },
          ]}
          testID="historias-text-prev"
        >
          <Text style={[styles.pagerLabel, { color: color.ink }]}>Anterior</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isLast }}
          disabled={isLast}
          onPress={() => setPageIndex((value) => Math.min(story.pages.length - 1, value + 1))}
          style={({ pressed }) => [
            styles.pagerButton,
            { borderColor: color.border, backgroundColor: color.surface },
            isLast && { opacity: tokens.opacity.pressed },
            pressed && { opacity: tokens.opacity.pressed },
          ]}
          testID="historias-text-next"
        >
          <Text style={[styles.pagerLabel, { color: color.ink }]}>Siguiente</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <AppButton
          onPress={() =>
            openPassage({
              book: story.book,
              chapter: story.chapter,
              ...(story.verse === undefined ? {} : { verse: story.verse }),
            })
          }
          testID="historias-text-read"
        >
          Leer el pasaje en la Biblia
        </AppButton>
        <AppButton
          onPress={() =>
            goToChat({
              book: story.book,
              chapter: story.chapter,
              ...(story.verse === undefined ? {} : { verse: story.verse }),
            })
          }
          testID="historias-text-ask"
          variant="secondary"
        >
          Preguntar sobre este texto
        </AppButton>
        <AppButton
          onPress={() => goToVoices(story.voiceSlug)}
          testID="historias-text-voices"
          variant="secondary"
        >
          {story.voiceSlug ? "Hablar en Voces" : "Ir a Voces"}
        </AppButton>
      </View>
    </AppScreen>
  );
}

function StateCard({ detail, title }: { detail: string; title: string }) {
  const { color } = useTheme();
  return (
    <AppScreen contentStyle={styles.stateContent} style={{ backgroundColor: color.surfaceAlt }}>
      <View style={styles.stateCopy}>
        <Text style={[styles.title, { color: color.ink }]}>{title}</Text>
        <Text style={[styles.detail, { color: color.inkMuted }]}>{detail}</Text>
        <AppButton onPress={() => router.back()} variant="secondary">
          Volver
        </AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: tokens.space.md },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
  },
  reference: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  pageLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginTop: tokens.space.xl,
  },
  body: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight,
    marginTop: tokens.space.md,
  },
  pager: {
    flexDirection: "row",
    gap: tokens.space.md,
    marginTop: tokens.space.xxl,
  },
  pagerButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: tokens.space.md,
  },
  pagerLabel: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight,
  },
  actions: { gap: tokens.space.md, marginTop: tokens.space.xxl, paddingBottom: tokens.space.xxl },
  stateContent: { flex: 1, justifyContent: "center" },
  stateCopy: { gap: tokens.space.lg, paddingHorizontal: tokens.space.xl },
  detail: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
});

/** Sin señal no puede responder: se avisa en vez de quedarse cargando (#160). */
export default function TextStoryViewerScreen() {
  return (
    <RequiresConnection module="stories">
      <TextStoryViewerScreenContent />
    </RequiresConnection>
  );
}
