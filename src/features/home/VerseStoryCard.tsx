import type { Ref } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { tokens } from "../../theme/tokens";
import { storyChrome, verseStoryLayout } from "./verseStoryLayout";

type VerseStoryCardProps = {
  ref?: Ref<View>;
  verseText: string;
  /** "Salmos 46:1 · RV1909". */
  citation: string;
  imageUrl: string;
  /** Puntos de pantalla por píxel de salida: la tarjeta se dibuja chica y se captura a 1080×1920. */
  scale: number;
  /** La foto ya cargó (o falló): recién ahí conviene capturar. */
  onImageSettled: () => void;
  /** Nombre de la temporada activa (#199): va arriba al centro. Sin temporada, la imagen de siempre. */
  seasonName?: string | null;
};

const image = tokens.storyImage;
// La imagen va siempre con la paleta de noche: texto claro sobre foto oscurecida.
const night = tokens.night.color;

/**
 * Tarjeta 9:16 para el estado de WhatsApp (#161, design/oleada-ux.md §U2).
 * No se ve: `/hoy` la dibuja fuera de pantalla y la captura con
 * react-native-view-shot. Todas las medidas salen de `tokens.storyImage`
 * (píxeles de salida) multiplicadas por `scale`.
 *
 * Con temporada (#199, §Temporadas) el nombre va en `overline` arriba al
 * centro, `surface` al 85 %; el versículo cede ese alto (`verseStoryLayout`).
 */
export function VerseStoryCard({
  citation,
  imageUrl,
  onImageSettled,
  ref,
  scale,
  seasonName,
  verseText,
}: VerseStoryCardProps) {
  const layout = verseStoryLayout(`“${verseText}”`, image, { withSeason: Boolean(seasonName) });
  const chrome = storyChrome();
  const px = (value: number) => value * scale;

  return (
    <View
      collapsable={false}
      ref={ref}
      style={[styles.root, { backgroundColor: night.bg, height: px(image.height), width: px(image.width) }]}
    >
      <Image
        onError={onImageSettled}
        onLoad={onImageSettled}
        resizeMode="cover"
        source={{ uri: imageUrl }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: night.imageScrim }]} />

      <View style={[StyleSheet.absoluteFill, { paddingHorizontal: px(image.paddingX), paddingVertical: px(image.paddingY) }]}>
        {seasonName ? (
          <Text
            numberOfLines={1}
            style={[
              styles.season,
              {
                color: tokens.color.surface,
                fontSize: px(image.season),
                letterSpacing: px(chrome.seasonLetterSpacing),
                lineHeight: px(chrome.seasonLineHeight),
              },
            ]}
          >
            {seasonName}
          </Text>
        ) : null}
        <View style={styles.center}>
          <Text
            numberOfLines={layout.maxLines}
            style={[
              styles.verse,
              { color: tokens.color.surface, fontSize: px(layout.fontSize), lineHeight: px(layout.lineHeight) },
            ]}
          >
            “{verseText}”
          </Text>
          <Text
            style={[
              styles.citation,
              {
                color: tokens.color.surface,
                fontSize: px(image.reference),
                lineHeight: px(image.reference * image.verseLineHeight),
                marginTop: px(chrome.referenceGap),
              },
            ]}
          >
            {citation}
          </Text>
        </View>

        <View style={[styles.brand, { gap: px(chrome.brandGap) }]}>
          <Image
            source={require("../../../design/logo.png")}
            style={{
              borderRadius: px(chrome.logoSize) * (tokens.radius.xl / tokens.size.logoSmall),
              height: px(chrome.logoSize),
              width: px(chrome.logoSize),
            }}
          />
          <Text
            style={[
              styles.brandName,
              { color: tokens.color.surface, fontSize: px(image.brand), lineHeight: px(image.brand * image.verseLineHeight) },
            ]}
          >
            Bible AI Honduras
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  verse: { fontFamily: tokens.font.serif, textAlign: "center" },
  citation: { fontFamily: tokens.font.sansMedium, opacity: tokens.opacity.imageMuted, textAlign: "center" },
  season: { fontFamily: tokens.font.sansMedium, opacity: tokens.opacity.imageMuted, textAlign: "center", textTransform: "uppercase" },
  brand: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
  brandName: { fontFamily: tokens.font.sansMedium },
});
