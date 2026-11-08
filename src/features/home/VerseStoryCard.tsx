import type { Ref } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { tokens } from "../../theme/tokens";
import type { StoryPalette } from "./storyPalettes";
import {
  storyChrome,
  storyFrame,
  verseStoryLayout,
  type DedicationBlock,
  type StoryFormat,
  type StoryLayout,
} from "./verseStoryLayout";

type VerseStoryCardProps = {
  ref?: Ref<View>;
  verseText: string;
  /** "Salmos 46:1 · RV1909". */
  citation: string;
  /** Foto de fondo (versículo del día). Sin foto, va `palette`. */
  imageUrl?: string;
  /** Fondo liso de una plantilla (versículo dedicado, #202). */
  palette?: StoryPalette;
  /** Puntos de pantalla por píxel de salida: la tarjeta se dibuja chica y se captura a 1080×1920. */
  scale: number;
  /** La foto ya cargó (o falló): recién ahí conviene capturar. */
  onImageSettled?: () => void;
  /** Nombre de la temporada activa (#199) o título de la plantilla: va arriba al centro. */
  seasonName?: string | null;
  /** 9:16 (default) o cuadrada para el chat (#202). */
  format?: StoryFormat;
  /** Versículo dedicado (#202): "Para …", filete y dedicatoria arriba del versículo. */
  dedication?: { to: string; message: string; block: DedicationBlock };
  /** Composición (Crear imagen): clásica centrada, póster o minimal. */
  layout?: StoryLayout;
  /** El texto va entero aunque haya que achicarlo (Crear imagen, como la dedicatoria). */
  fitWhole?: boolean;
};

const image = tokens.storyImage;
// Con foto, la imagen va siempre con la paleta de noche: texto claro sobre foto oscurecida.
const night = tokens.night.color;

/**
 * Generador único de imágenes para compartir (#161, design/oleada-ux.md §U2;
 * versículo dedicado #202, design/dedicar-y-escuchar.md §Dedicar). No se ve:
 * la pantalla lo dibuja fuera de pantalla y lo captura con
 * react-native-view-shot. Todas las medidas salen de `tokens.storyImage`
 * (píxeles de salida) multiplicadas por `scale`.
 *
 * Con temporada (#199, §Temporadas) el nombre va en `overline` arriba al
 * centro, `surface` al 85 %; el versículo cede ese alto (`verseStoryLayout`).
 *
 * Composiciones de "Crear imagen" (design/oleada-ux.md §Crear imagen): Póster
 * lleva el versículo grande abajo, a la izquierda, con un filete arriba;
 * Minimal lo lleva sin comillas, más chico, con una línea fina sobre la cita
 * en mayúsculas espaciadas.
 */
export function VerseStoryCard({
  citation,
  dedication,
  fitWhole = false,
  format = "story",
  imageUrl,
  layout = "classic",
  onImageSettled,
  palette,
  ref,
  scale,
  seasonName,
  verseText,
}: VerseStoryCardProps) {
  const shownVerse = layout === "minimal" ? verseText : `“${verseText}”`;
  const fit = verseStoryLayout(shownVerse, image, {
    withSeason: Boolean(seasonName),
    format,
    dedication: dedication?.block,
    layout,
    fitWhole,
  });
  const poster = layout === "poster";
  const chrome = storyChrome();
  const frame = storyFrame(image, format);
  const px = (value: number) => value * scale;
  const ink = palette?.ink ?? tokens.color.surface;
  const muted = palette?.muted ?? tokens.color.surface;
  const accent = palette?.accent ?? tokens.color.surface;

  return (
    <View
      collapsable={false}
      ref={ref}
      style={[styles.root, { backgroundColor: palette?.bg ?? night.bg, height: px(frame.height), width: px(frame.width) }]}
    >
      {imageUrl ? (
        <>
          <Image
            onError={onImageSettled}
            onLoad={onImageSettled}
            resizeMode="cover"
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: night.imageScrim }]} />
        </>
      ) : null}

      <View style={[StyleSheet.absoluteFill, { paddingHorizontal: px(image.paddingX), paddingVertical: px(frame.paddingY) }]}>
        {seasonName ? (
          <Text
            numberOfLines={1}
            style={[
              styles.season,
              {
                color: palette ? accent : tokens.color.surface,
                fontSize: px(image.season),
                letterSpacing: px(chrome.seasonLetterSpacing),
                lineHeight: px(chrome.seasonLineHeight),
              },
            ]}
          >
            {seasonName}
          </Text>
        ) : null}
        {/* Póster: el bloque se apoya abajo y deja sobre la marca el aire que `verseStoryLayout` le reserva. */}
        <View style={poster ? [styles.posterBody, { marginBottom: px(chrome.brandAir) }] : styles.center}>
          {dedication ? (
            <View style={[styles.dedication, { gap: px(dedication.block.toSize / 2), marginBottom: px(dedication.block.toSize / 2) }]}>
              <Text
                numberOfLines={dedication.block.toLines}
                style={[
                  styles.to,
                  {
                    color: ink,
                    fontSize: px(dedication.block.toSize),
                    lineHeight: px(dedication.block.toSize * image.verseLineHeight),
                  },
                ]}
                testID="dedication-to"
              >
                Para {dedication.to.trim()}
              </Text>
              <View style={{ backgroundColor: accent, height: px(image.dedicationRule), width: px(image.dedicationRuleWidth) }} />
              {dedication.message.trim() ? (
                <Text
                  numberOfLines={dedication.block.messageLines}
                  style={[
                    styles.message,
                    {
                      color: muted,
                      fontSize: px(image.dedicationMessage),
                      lineHeight: px(image.dedicationMessage * image.verseLineHeight),
                    },
                  ]}
                >
                  “{dedication.message.trim()}”
                </Text>
              ) : null}
            </View>
          ) : null}
          {poster ? (
            <View
              style={{
                backgroundColor: accent,
                height: px(image.dedicationRule),
                marginBottom: px(chrome.referenceGap),
                width: px(image.dedicationRuleWidth),
              }}
            />
          ) : null}
          <Text
            numberOfLines={fit.maxLines}
            style={[
              styles.verse,
              poster && styles.alignStart,
              { color: ink, fontSize: px(fit.fontSize), lineHeight: px(fit.lineHeight) },
            ]}
            testID="verse-story-text"
          >
            {shownVerse}
          </Text>
          {layout === "minimal" ? (
            <View
              style={{
                backgroundColor: accent,
                height: px(image.minimalRule),
                marginTop: px(chrome.referenceGap),
                width: px(image.minimalRuleWidth),
              }}
            />
          ) : null}
          <Text
            style={[
              styles.citation,
              poster && styles.alignStart,
              layout === "minimal" && styles.citationCaps,
              {
                color: palette ? muted : tokens.color.surface,
                fontSize: px(image.reference),
                letterSpacing: layout === "minimal" ? px(chrome.citationLetterSpacing) : undefined,
                lineHeight: px(image.reference * image.verseLineHeight),
                marginTop: px(chrome.referenceGap),
              },
            ]}
          >
            {citation}
          </Text>
        </View>

        <View style={[styles.brand, poster && styles.brandStart, { gap: px(chrome.brandGap) }]}>
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
              { color: palette ? muted : tokens.color.surface, fontSize: px(image.brand), lineHeight: px(image.brand * image.verseLineHeight) },
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
  posterBody: { alignItems: "flex-start", flex: 1, justifyContent: "flex-end" },
  alignStart: { alignSelf: "stretch", textAlign: "left" },
  dedication: { alignItems: "center" },
  to: { fontFamily: tokens.font.serif, fontStyle: "italic", textAlign: "center" },
  message: { fontFamily: tokens.font.serif, fontStyle: "italic", textAlign: "center" },
  verse: { fontFamily: tokens.font.serif, textAlign: "center" },
  citation: { fontFamily: tokens.font.sansMedium, opacity: tokens.opacity.imageMuted, textAlign: "center" },
  citationCaps: { textTransform: "uppercase" },
  season: { fontFamily: tokens.font.sansMedium, opacity: tokens.opacity.imageMuted, textAlign: "center", textTransform: "uppercase" },
  brand: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
  brandStart: { justifyContent: "flex-start" },
  brandName: { fontFamily: tokens.font.sansMedium },
});
