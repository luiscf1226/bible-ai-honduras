import { useAction, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { FilterPills } from "../src/components/FilterPills";
import { Icon } from "../src/components/Icon";
import { LoadingState } from "../src/components/LoadingState";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { captureStoryImage } from "../src/features/home/captureStory";
import { ComposerField, OffscreenCapture } from "../src/features/home/StoryComposerParts";
import { VerseStoryCard } from "../src/features/home/VerseStoryCard";
import { fittingStoryFormats, storyFrame } from "../src/features/home/verseStoryLayout";
import {
  AI_BACKGROUND_ID,
  aiNoticeText,
  buildVerseImageShareText,
  chooseBackground,
  composerBackgrounds,
  DEFAULT_VERSE_IMAGE_STYLE,
  readVerseImageParams,
  VERSE_IMAGE_FORMATS,
  VERSE_IMAGE_LAYOUTS,
  verseImageReference,
  type AiNotice,
  type VerseImageBackground,
  type VerseImageStyle,
} from "../src/features/verseImage/verseImageLogic";
import { readSavedStyle, writeSavedStyle } from "../src/features/verseImage/verseImageStorage";
import { openDedication } from "../src/lib/openPassage";
import { shareImage } from "../src/lib/share";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

type Feedback = "error" | "copied" | null;

/**
 * Crear imagen de cualquier versículo (design/oleada-ux.md §Crear imagen):
 * vista previa grande, carrusel de fondos (con IA, fotos y colores),
 * composición y formato, y un botón que manda la imagen por el compartir de
 * siempre (regla dura #3). Se llega desde la hoja del versículo, `/hoy` y el
 * feed (`openVerseImage`). El texto es el del corpus, sin editar (regla dura #4).
 */
export default function VerseImageScreen() {
  const { color, season } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string; verseEnd?: string }>();
  const passage = useMemo(
    () => readVerseImageParams({ book: params.book, chapter: params.chapter, verse: params.verse, verseEnd: params.verseEnd }),
    [params.book, params.chapter, params.verse, params.verseEnd],
  );
  const passageArgs = passage
    ? {
        book: passage.book,
        chapter: passage.chapter,
        verse: passage.verse,
        ...(passage.verseEnd ? { verseEnd: passage.verseEnd } : {}),
      }
    : null;
  const composed = useQuery(api.verseImage.compose, passageArgs ?? "skip");
  const quota = useQuery(api.quotas.remaining, { module: "verseImage" });
  const generateBackground = useAction(api.verseImage.generateBackground);
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;

  const [style, setStyle] = useState<VerseImageStyle>(DEFAULT_VERSE_IMAGE_STYLE);
  const touched = useRef(false);
  useEffect(() => {
    void readSavedStyle().then((saved) => {
      if (!touched.current) setStyle(saved);
    });
  }, []);
  const updateStyle = (patch: Partial<VerseImageStyle>) => {
    touched.current = true;
    setStyle((current) => {
      const next = { ...current, ...patch };
      void writeSavedStyle(next);
      return next;
    });
  };

  const [painting, setPainting] = useState(false);
  const [aiNotice, setAiNotice] = useState<AiNotice>(null);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const captureView = useRef<View>(null);
  const settledImage = useRef<string | null>(null);

  const backgrounds = useMemo(
    () => (composed ? composerBackgrounds({ aiImageUrl: composed.aiImageUrl, photos: composed.photos, season }) : []),
    [composed, season],
  );
  const background = chooseBackground(style.background, backgrounds);
  const verseText = composed?.text ?? null;
  const version = composed?.version ?? "";
  const reference = passage ? verseImageReference(passage, composed?.endVerse ?? null) : "";
  const citation = `${reference} · ${version}`;
  const withSeason = background?.id === "temporada" && Boolean(season?.name);
  const formats = useMemo(
    () =>
      verseText
        ? fittingStoryFormats(style.layout === "minimal" ? verseText : `“${verseText}”`, {
            layout: style.layout,
            fitWhole: true,
            withSeason,
          })
        : [],
    [style.layout, verseText, withSeason],
  );
  const format = formats.includes(style.format) ? style.format : (formats[0] ?? "story");
  const tooLong = Boolean(verseText) && formats.length === 0;
  const frame = storyFrame(tokens.storyImage, format);
  const previewWidth = format === "story" ? tokens.size.verseImagePreview.story : tokens.size.verseImagePreview.square;
  const photoUrl = background?.kind === "photo" ? background.imageUrl : null;
  const hasAi = backgrounds.some((item) => item.id === AI_BACKGROUND_ID);
  const canShare = Boolean(verseText && referralCode && background) && !tooLong && !sharing;

  const cardProps = background
    ? {
        citation,
        fitWhole: true,
        format,
        layout: style.layout,
        verseText: verseText ?? "",
        ...(background.kind === "photo" ? { imageUrl: background.imageUrl } : { palette: background.palette }),
        seasonName: background.id === "temporada" ? season?.name : undefined,
      }
    : null;

  const onPaint = async () => {
    if (!passageArgs || painting) return;
    setPainting(true);
    setAiNotice(null);
    try {
      const result = await generateBackground(passageArgs);
      if (result.status === "ready") updateStyle({ background: AI_BACKGROUND_ID });
      else if (result.status === "limit_reached") setAiNotice("limit");
      else if (result.status === "busy") setAiNotice("busy");
      else if (result.status === "failed" && result.reason === "no_credit") setAiNotice("no_credit");
      else setAiNotice("failed");
    } catch {
      setAiNotice("failed");
    } finally {
      setPainting(false);
    }
  };

  const onShare = async () => {
    if (!canShare || !background || !referralCode) return;
    setSharing(true);
    setFeedback(null);
    try {
      const fileUri = await captureStoryImage(captureView, {
        format,
        imageReady: () => photoUrl === null || settledImage.current === photoUrl,
      });
      const result = await shareImage({
        fileUri,
        origin: "verse_image",
        referralCode,
        text: buildVerseImageShareText({ reference, version }),
      });
      if (result.status === "error") setFeedback("error");
      else if (result.status === "shared" && result.textCopied) setFeedback("copied");
    } catch {
      setFeedback("error");
    } finally {
      setSharing(false);
    }
  };

  if (!passage || composed === undefined || !composed.text || !cardProps) {
    return (
      <AppScreen contentStyle={styles.statusScreen}>
        <ScreenHeader title="Crear imagen" testID="imagen-back" />
        {passage && composed === undefined ? (
          <LoadingState message="Buscando el versículo…" testID="imagen-loading" />
        ) : (
          <Text style={[styles.status, { color: color.inkMuted }]} testID="imagen-unavailable">
            No encontramos ese versículo en tu versión de la Biblia. Elegí otro desde el lector.
          </Text>
        )}
      </AppScreen>
    );
  }

  const quotaLeft = quota && !quota.isPro ? quota.remaining : null;
  const noticeText = aiNoticeText(aiNotice ?? (quotaLeft === 0 && !hasAi ? "limit" : null));

  return (
    <AppScreen contentStyle={styles.screen}>
      <ScreenHeader style={styles.header} title="Crear imagen" testID="imagen-back" />
      <ScrollView contentContainerStyle={styles.content} testID="imagen-screen">
        <View style={styles.previewWrap}>
          <View style={[styles.preview, { borderColor: color.border }]} testID="imagen-preview">
            <VerseStoryCard {...cardProps} scale={previewWidth / frame.width} />
          </View>
        </View>

        <ComposerField label="FONDO">
          <ScrollView
            contentContainerStyle={styles.carousel}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carouselBleed}
            testID="imagen-backgrounds"
          >
            {hasAi ? null : (
              <PaintTile
                disabled={quotaLeft === 0}
                onPress={() => void onPaint()}
                painting={painting}
                remaining={quotaLeft}
              />
            )}
            {backgrounds.map((item) => (
              <BackgroundTile
                item={item}
                key={item.id}
                onPress={() => updateStyle({ background: item.id })}
                selected={item.id === background?.id}
              />
            ))}
          </ScrollView>
          {noticeText ? (
            <Text style={[styles.note, { color: color.inkSoft }]} testID="imagen-ai-notice">
              {noticeText}
            </Text>
          ) : null}
        </ComposerField>

        <ComposerField label="COMPOSICIÓN">
          <FilterPills
            onSelect={(layout) => updateStyle({ layout })}
            options={VERSE_IMAGE_LAYOUTS}
            selected={style.layout}
            testID="imagen-layout"
          />
        </ComposerField>

        <ComposerField label="FORMATO">
          <FilterPills
            onSelect={(next) => updateStyle({ format: next })}
            options={VERSE_IMAGE_FORMATS.filter((item) => formats.includes(item.id))}
            selected={format}
            testID="imagen-format"
          />
          {tooLong ? (
            <Text style={[styles.note, { color: color.inkSoft }]} testID="imagen-too-long">
              Es mucho texto para una imagen: elegí menos versículos desde el lector.
            </Text>
          ) : formats.length < VERSE_IMAGE_FORMATS.length ? (
            <Text style={[styles.note, { color: color.inkSoft }]} testID="imagen-format-note">
              Este pasaje es largo: para que entre entero, va en formato estado.
            </Text>
          ) : null}
        </ComposerField>

        <View style={styles.actions}>
          <View style={styles.buttonRow}>
            <AppButton disabled={!canShare} icon="share" onPress={() => void onShare()} style={styles.button} testID="imagen-share">
              {sharing ? "Preparando…" : "Compartir imagen"}
            </AppButton>
            {passage.verseEnd ? null : (
              <AppButton
                icon="gift"
                onPress={() => openDedication(passage)}
                style={styles.button}
                testID="imagen-dedicate"
                variant="secondary"
              >
                Dedicar
              </AppButton>
            )}
          </View>
          {feedback === "error" ? (
            <Text style={[styles.feedback, { color: color.danger }]} testID="imagen-error">
              No pudimos abrir el compartir. Probá de nuevo.
            </Text>
          ) : feedback === "copied" ? (
            <Text style={[styles.feedback, { color: color.inkSoft }]} testID="imagen-copied">
              Copiamos el texto con tu link: pegalo al mandar la imagen.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <OffscreenCapture>
        <VerseStoryCard
          {...cardProps}
          onImageSettled={() => {
            settledImage.current = photoUrl;
          }}
          ref={captureView}
          scale={windowWidth / frame.width}
        />
      </OffscreenCapture>
    </AppScreen>
  );
}

/** Miniatura 3:4 de un fondo: el color o la foto con su velo y un "Aa" en serif. */
function BackgroundTile({ item, onPress, selected }: { item: VerseImageBackground; onPress: () => void; selected: boolean }) {
  const { color } = useTheme();
  const ink = item.kind === "color" ? item.palette.ink : tokens.color.surface;
  return (
    <Pressable
      accessibilityLabel={item.kind === "photo" ? `Fondo ${item.label}: ${item.imageAlt}` : `Fondo ${item.label}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      testID={`imagen-bg-${item.id}`}
    >
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: item.kind === "color" ? item.palette.bg : tokens.night.color.bg,
            borderColor: selected ? color.accent : color.border,
          },
        ]}
      >
        {item.kind === "photo" ? (
          <>
            <Image resizeMode="cover" source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.night.color.imageScrim }]} />
          </>
        ) : null}
        <Text style={[styles.thumbGlyph, { color: ink }]}>Aa</Text>
      </View>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: selected ? color.ink : color.inkMuted }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

/** Primera miniatura cuando la cita no tiene fondo con IA: lo pinta (con la cuota del día). */
function PaintTile({
  disabled,
  onPress,
  painting,
  remaining,
}: {
  disabled: boolean;
  onPress: () => void;
  painting: boolean;
  remaining: number | null;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={remaining === null ? undefined : `Te quedan ${remaining} hoy.`}
      accessibilityLabel="Pintar un fondo con IA para este versículo"
      accessibilityRole="button"
      accessibilityState={{ busy: painting, disabled: disabled || painting }}
      disabled={disabled || painting}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, disabled && styles.disabled]}
      testID="imagen-bg-paint"
    >
      <View style={[styles.thumb, styles.paintThumb, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
        {painting ? <ActivityIndicator color={color.accent} /> : <Icon color={color.accent} name="image" size="lg" />}
      </View>
      <Text numberOfLines={1} style={[styles.tileLabel, { color: color.inkMuted }]}>
        {painting ? "Pintando…" : "Con IA"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: { paddingHorizontal: tokens.screenPadding.horizontal },
  statusScreen: { gap: tokens.space.xl },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  content: {
    gap: tokens.space.xl,
    paddingBottom: tokens.space.xxl,
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingTop: tokens.space.lg,
  },
  previewWrap: { alignItems: "center" },
  preview: { borderRadius: tokens.radius.lg, borderWidth: 1, overflow: "hidden" },
  // El carrusel llega hasta los bordes de la pantalla; la primera miniatura queda alineada con el resto.
  carouselBleed: { marginHorizontal: -tokens.screenPadding.horizontal },
  carousel: { gap: tokens.space.md, paddingHorizontal: tokens.screenPadding.horizontal },
  tile: { alignItems: "center", gap: tokens.space.xs, width: tokens.size.styleThumb.width },
  thumb: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: tokens.size.ring,
    height: tokens.size.styleThumb.height,
    justifyContent: "center",
    overflow: "hidden",
    width: tokens.size.styleThumb.width,
  },
  paintThumb: { borderStyle: "dashed" },
  thumbGlyph: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  tileLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  note: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  actions: { gap: tokens.space.sm },
  buttonRow: { flexDirection: "row", gap: tokens.space.sm },
  button: { flex: 1, paddingHorizontal: tokens.space.sm },
  feedback: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  pressed: { opacity: tokens.opacity.pressed },
  disabled: { opacity: tokens.opacity.imageMuted },
});
