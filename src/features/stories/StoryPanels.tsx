// Paneles visuales del visor; los estados de imagen viven en storyViewer.ts.
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { openPassage } from "../../lib/openPassage";
import type { StoryCatalogItem } from "./contracts";
import { parseStoryReference } from "./storyReference";
import { resolveSceneImage, type StorySceneImages } from "./storyViewer";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

type StoryViewerProps = {
  images?: StorySceneImages;
  story: StoryCatalogItem;
};

export function StoryViewer({ images = {}, story }: StoryViewerProps) {
  const { color } = useTheme();

  return (
    <View style={styles.panels} testID="story-viewer">
      {story.scenes.map((scene) => {
        const image = resolveSceneImage(scene.id, images);
        // Puente al lector (#115): si la referencia no resuelve a un capítulo
        // real, no hay botón — nunca un link roto.
        const passage = parseStoryReference(scene.reference);

        return (
          <View
            key={scene.id}
            style={[styles.panel, { backgroundColor: color.surface, borderColor: color.border }]}
            testID={`story-scene-${scene.id}`}
          >
            <SceneImageSlot color={color} image={image} sceneTitle={scene.title} />
            <View style={styles.copy}>
              <Text style={[styles.sceneNumber, { color: color.accent }]}>ESCENA {scene.order}</Text>
              <Text style={[styles.narration, { color: color.ink }]}>{scene.narration}</Text>
              <Text style={[styles.reference, { color: color.inkMuted }]}>{scene.reference}</Text>
              {passage ? (
                <Pressable
                  accessibilityHint={`Abre ${scene.reference} en el lector.`}
                  accessibilityRole="button"
                  onPress={() => openPassage(passage)}
                  style={({ pressed }) => [styles.readLink, pressed && styles.pressed]}
                  testID={`story-scene-read-${scene.id}`}
                >
                  <Text style={[styles.readLinkLabel, { color: color.accent }]}>Leer en la Biblia</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SceneImageSlot({
  color,
  image,
  sceneTitle,
}: {
  color: ReturnType<typeof useTheme>["color"];
  image: ReturnType<typeof resolveSceneImage>;
  sceneTitle: string;
}) {
  if (image.status === "ready" && image.uri) {
    return (
      <Image
        accessibilityLabel={`Ilustración generada: ${sceneTitle}`}
        source={{ uri: image.uri }}
        style={styles.image}
      />
    );
  }

  if (image.status === "generating") {
    return (
      <View
        accessibilityLabel={`Generando ilustración: ${sceneTitle}`}
        style={[styles.imageSlot, { backgroundColor: color.surfaceSunk }]}
      >
        <ActivityIndicator color={color.accent} />
        <Text style={[styles.imageStatus, { color: color.inkMuted }]}>Generando ilustración…</Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={`Ilustración aún no disponible: ${sceneTitle}`}
      style={[styles.imageSlot, { backgroundColor: color.surfaceSunk }]}
    >
      <Text style={[styles.imageStatus, { color: color.inkMuted }]}>Ilustración aún no disponible</Text>
      <Text style={[styles.imageHint, { color: color.inkSoft }]}>Aparecerá aquí cuando la generación esté lista.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panels: { gap: tokens.radius.lg },
  panel: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: { aspectRatio: 1, width: "100%" },
  imageSlot: {
    alignItems: "center",
    aspectRatio: 1,
    gap: tokens.space.sm,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xl,
  },
  imageStatus: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight,
    textAlign: "center",
  },
  imageHint: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  copy: { gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xl },
  sceneNumber: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  narration: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight,
  },
  reference: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  readLink: { alignSelf: "flex-start" },
  // Mismo estilo que el enlace "Compartir esta historia" del visor.
  readLinkLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
