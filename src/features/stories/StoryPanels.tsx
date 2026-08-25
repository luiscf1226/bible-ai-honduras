// Paneles visuales del visor; los estados de imagen viven en storyViewer.ts.
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import type { StoryCatalogItem } from "./contracts";
import { resolveSceneImage, type StorySceneImages } from "./storyViewer";
import { tokens } from "../../theme/tokens";

type StoryViewerProps = {
  images?: StorySceneImages;
  story: StoryCatalogItem;
};

export function StoryViewer({ images = {}, story }: StoryViewerProps) {
  return (
    <View style={styles.panels} testID="story-viewer">
      {story.scenes.map((scene) => {
        const image = resolveSceneImage(scene.id, images);

        return (
          <View key={scene.id} style={styles.panel} testID={`story-scene-${scene.id}`}>
            <SceneImageSlot image={image} sceneTitle={scene.title} />
            <View style={styles.copy}>
              <Text style={styles.sceneNumber}>ESCENA {scene.order}</Text>
              <Text style={styles.narration}>{scene.narration}</Text>
              <Text style={styles.reference}>{scene.reference}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SceneImageSlot({ image, sceneTitle }: { image: ReturnType<typeof resolveSceneImage>; sceneTitle: string }) {
  if (image.status === "ready" && image.uri) {
    return <Image accessibilityLabel={`Ilustración generada: ${sceneTitle}`} source={{ uri: image.uri }} style={styles.image} />;
  }

  if (image.status === "generating") {
    return (
      <View accessibilityLabel={`Generando ilustración: ${sceneTitle}`} style={styles.imageSlot}>
        <ActivityIndicator color={tokens.color.accent} />
        <Text style={styles.imageStatus}>Generando ilustración…</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel={`Ilustración aún no disponible: ${sceneTitle}`} style={styles.imageSlot}>
      <Text style={styles.imageStatus}>Ilustración aún no disponible</Text>
      <Text style={styles.imageHint}>Aparecerá aquí cuando la generación esté lista.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panels: { gap: tokens.radius.lg },
  panel: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    overflow: "hidden"
  },
  image: { aspectRatio: 1, width: "100%" },
  imageSlot: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: tokens.color.surfaceSunk,
    gap: tokens.space.sm,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xl
  },
  imageStatus: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight,
    textAlign: "center"
  },
  imageHint: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center"
  },
  copy: { gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xl },
  sceneNumber: {
    color: tokens.color.accent,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight
  },
  narration: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight
  },
  reference: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight
  }
});
