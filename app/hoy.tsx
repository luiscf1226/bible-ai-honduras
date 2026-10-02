import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { CitationLink } from "../src/components/CitationLink";
import { Icon, type IconName } from "../src/components/Icon";
import { LoadingState } from "../src/components/LoadingState";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { hondurasDate } from "../src/features/home/homeCards";
import { buildDevotionalShareText, buildVerseImageShareText } from "../src/features/home/shareDevotional";
import { useTodayDevotional, useTodayVerse } from "../src/features/home/useTodayDevotional";
import { VerseStoryCard } from "../src/features/home/VerseStoryCard";
import { storyCaptureSize } from "../src/features/home/verseStoryLayout";
import { goToChat } from "../src/lib/goToChat";
import { openPassage } from "../src/lib/openPassage";
import { asFileUri, shareContent, shareImage } from "../src/lib/share";
import { track } from "../src/lib/telemetry";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

// Si la foto del devocional tarda, la imagen se captura igual (con el fondo
// de noche) antes que dejar a la persona esperando.
const STORY_IMAGE_WAIT_MS = 4000;
const STORY_IMAGE_POLL_MS = 100;

type ShareFeedback = "error" | "copied" | null;

/**
 * Versículo del día en pantalla propia (#194, design/oleada-ux.md §U2): foto,
 * versículo grande con su cita tocable, el devocional por secciones y las
 * acciones (compartir como imagen o texto, guardar, leer el capítulo,
 * preguntar). Reemplaza la expansión que vivía dentro del inicio.
 */
export default function HoyScreen() {
  const { color, dark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { retry, state } = useTodayDevotional();
  const devotional = state.status === "ready" ? state.devotional : null;
  const verse = useTodayVerse(devotional?.verseRef);
  const passage = verse.passage;
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;
  const chapterBookmarks = useQuery(
    api.reading.chapterBookmarks,
    passage ? { book: passage.book, chapter: passage.chapter } : "skip",
  );
  const toggleBookmark = useMutation(api.reading.toggleBookmark);
  const isSaved = Boolean(passage && chapterBookmarks?.some((item) => item.verse === passage.verse));

  const storyRef = useRef<View>(null);
  const storyImageSettled = useRef(false);
  const [sharing, setSharing] = useState<"image" | "text" | null>(null);
  const [shareFeedback, setShareFeedback] = useState<ShareFeedback>(null);
  const [bookmarkFailed, setBookmarkFailed] = useState(false);

  useEffect(() => {
    track("today_opened");
  }, []);

  const onShareImage = async () => {
    if (!devotional || !referralCode || !verse.text || sharing) return;
    setSharing("image");
    setShareFeedback(null);
    try {
      for (let waited = 0; !storyImageSettled.current && waited < STORY_IMAGE_WAIT_MS; waited += STORY_IMAGE_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, STORY_IMAGE_POLL_MS));
      }
      const fileUri = await captureRef(storyRef, {
        format: "png",
        quality: 1,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
        ...storyCaptureSize(Platform.OS, PixelRatio.get()),
      });
      const result = await shareImage({
        fileUri: asFileUri(fileUri),
        referralCode,
        text: buildVerseImageShareText({ verseRef: devotional.verseRef, version: verse.version }),
      });
      // Cancelar no es error (iOS: dismissed). En Android el texto con el
      // link va al portapapeles: se avisa para que lo pegue en el estado.
      if (result.status === "error") setShareFeedback("error");
      else if (result.status === "shared" && result.textCopied) setShareFeedback("copied");
    } catch {
      setShareFeedback("error");
    } finally {
      setSharing(null);
    }
  };

  const onShareText = async () => {
    if (!devotional || !referralCode || sharing) return;
    setSharing("text");
    setShareFeedback(null);
    const result = await shareContent({
      referralCode,
      text: buildDevotionalShareText({ reflection: devotional.reflection ?? "", verseRef: devotional.verseRef, version: verse.version }),
    });
    if (result.status === "error") setShareFeedback("error");
    setSharing(null);
  };

  const onToggleBookmark = async () => {
    if (!passage) return;
    setBookmarkFailed(false);
    try {
      await toggleBookmark({ book: passage.book, chapter: passage.chapter, verse: passage.verse });
    } catch {
      setBookmarkFailed(true);
    }
  };

  if (state.status !== "ready" || !devotional) {
    return (
      <AppScreen contentStyle={styles.statusScreen}>
        <ScreenHeader accessibilityLabel="Volver al inicio" testID="hoy-back" />
        {state.status === "error" ? (
          <View style={styles.statusBody} testID="hoy-error">
            <Text style={[styles.statusTitle, { color: color.ink }]}>No pudimos preparar tu lectura</Text>
            <Text style={[styles.statusText, { color: color.inkMuted }]}>Revisá tu conexión y probá de nuevo.</Text>
            <AppButton icon="refresh" onPress={retry} testID="hoy-retry">
              Intentar de nuevo
            </AppButton>
          </View>
        ) : (
          <LoadingState message="Preparando la lectura de hoy…" onRetry={retry} testID="hoy-loading" />
        )}
      </AppScreen>
    );
  }

  const shareDisabled = !referralCode || sharing !== null;

  return (
    <AppScreen contentStyle={styles.screen} style={{ backgroundColor: dark ? color.bg : color.surface }}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} testID="hoy-screen">
        <View style={[styles.hero, { backgroundColor: color.surfaceSunk }]}>
          <Image
            accessibilityLabel={devotional.imageAlt}
            resizeMode="cover"
            source={{ uri: devotional.imageUrl }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
          <ScreenHeader accessibilityLabel="Volver al inicio" onImage testID="hoy-back" />
          {/* Texto sobre la foto: siempre el `surface` claro, también de noche. */}
          <Text style={[styles.heroDate, { color: tokens.color.surface }]}>{hondurasDate().toUpperCase()}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.verseBlock}>
            <Text style={[styles.verse, { color: color.ink }]} testID="hoy-verse">
              {verse.text ? `“${verse.text}”` : devotional.verseRef}
            </Text>
            {passage ? (
              <CitationLink
                book={passage.book}
                chapter={passage.chapter}
                from="today"
                style={styles.citation}
                testID="hoy-citation"
                variant="block"
                verse={passage.verse}
                version={verse.version}
              />
            ) : null}
          </View>

          {devotional.openingPrayer ? (
            <Section color={color.accent} title="ORACIÓN INICIAL">
              <Text style={[styles.prayer, { color: color.inkMuted }]}>{devotional.openingPrayer}</Text>
            </Section>
          ) : null}
          {devotional.intro ? (
            <Section color={color.accent} title="INTRODUCCIÓN">
              <Text style={[styles.paragraph, { color: color.inkMuted }]}>{devotional.intro}</Text>
            </Section>
          ) : null}
          {devotional.reflection ? (
            <Section color={color.accent} title="UNA PAUSA PARA HOY">
              <Text style={[styles.paragraph, { color: color.ink }]} testID="hoy-reflection">
                {devotional.reflection}
              </Text>
            </Section>
          ) : null}
          {devotional.closingPrayer ? (
            <Section color={color.accent} title="ORACIÓN FINAL">
              <View style={[styles.closingCard, { backgroundColor: color.surfaceSunk }]}>
                <Text style={[styles.prayer, { color: color.inkMuted }]}>{devotional.closingPrayer}</Text>
              </View>
            </Section>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.shareRow}>
              <AppButton
                disabled={shareDisabled || !verse.text}
                icon="whatsapp"
                onPress={() => void onShareImage()}
                style={styles.shareButton}
                testID="hoy-share-image"
              >
                {sharing === "image" ? "Preparando…" : "Compartir imagen"}
              </AppButton>
              <AppButton
                disabled={shareDisabled}
                icon="share"
                onPress={() => void onShareText()}
                style={styles.shareButton}
                testID="hoy-share-text"
                variant="secondary"
              >
                Compartir texto
              </AppButton>
            </View>
            {shareFeedback === "error" ? (
              <Text style={[styles.feedback, { color: color.danger }]} testID="hoy-share-error">
                No pudimos abrir el compartir. Probá de nuevo.
              </Text>
            ) : shareFeedback === "copied" ? (
              <Text style={[styles.feedback, { color: color.inkSoft }]} testID="hoy-share-copied">
                Copiamos el texto con tu link: pegalo al publicar tu estado.
              </Text>
            ) : null}

            {passage ? (
              <View style={[styles.list, { borderColor: color.border }]}>
                <ActionRow
                  filled={isSaved}
                  icon="bookmark"
                  label={isSaved ? "Guardado" : "Guardar"}
                  onPress={() => void onToggleBookmark()}
                  selected={isSaved}
                  testID="hoy-bookmark"
                />
                <ActionRow
                  icon="book"
                  label="Leer el capítulo completo"
                  onPress={() => openPassage(passage)}
                  testID="hoy-read-chapter"
                />
                <ActionRow
                  icon="chat"
                  isLast
                  label="Preguntar sobre este versículo"
                  onPress={() => goToChat({ book: passage.book, chapter: passage.chapter, verse: passage.verse })}
                  testID="hoy-ask"
                />
              </View>
            ) : null}
            {bookmarkFailed ? (
              <Text style={[styles.feedback, { color: color.danger }]}>No pudimos guardar el versículo. Probá de nuevo.</Text>
            ) : null}
          </View>

        </View>
      </ScrollView>

      {/* Tarjeta 9:16 fuera de pantalla: solo existe para capturarla (#161). */}
      {verse.text ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.offscreen, { left: -windowWidth * 2 }]}
        >
          <VerseStoryCard
            citation={`${devotional.verseRef} · ${verse.version}`}
            imageUrl={devotional.imageUrl}
            onImageSettled={() => {
              storyImageSettled.current = true;
            }}
            ref={storyRef}
            scale={windowWidth / tokens.storyImage.width}
            verseText={verse.text}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

function Section({ children, color, title }: { children: React.ReactNode; color: string; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.overline, { color }]}>{title}</Text>
      {children}
    </View>
  );
}

function ActionRow({
  filled = false,
  icon,
  isLast = false,
  label,
  onPress,
  selected,
  testID,
}: {
  filled?: boolean;
  icon: IconName;
  isLast?: boolean;
  label: string;
  onPress: () => void;
  selected?: boolean;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && { borderBottomColor: color.border, borderBottomWidth: 1 },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Icon color={color.accent} filled={filled} name={icon} size="md" />
      <Text style={[styles.rowLabel, { color: color.ink }]}>{label}</Text>
      <Icon color={color.inkFaint} name="chevronRight" size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingVertical: 0 },
  scrollContent: { paddingBottom: tokens.space.xxl },
  statusScreen: { gap: tokens.space.xl },
  statusBody: { alignItems: "stretch", flex: 1, gap: tokens.space.md, justifyContent: "center" },
  statusTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center",
  },
  statusText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginBottom: tokens.space.md,
    textAlign: "center",
  },
  pressed: { opacity: tokens.opacity.pressed },
  hero: {
    height: tokens.size.hoyImage,
    justifyContent: "space-between",
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  heroDate: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  body: { gap: tokens.space.xxl, paddingHorizontal: tokens.screenPadding.horizontal, paddingTop: tokens.space.xxl },
  verseBlock: { gap: tokens.space.md },
  verse: { fontFamily: tokens.font.serif, fontSize: tokens.type.verseHero.size, lineHeight: tokens.type.verseHero.lineHeight },
  // La variante `block` trae sangría para el filete de Sentir; acá va alineada con el versículo.
  citation: { paddingLeft: 0 },
  section: { gap: tokens.space.sm },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  prayer: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  paragraph: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  closingCard: {
    borderRadius: tokens.radius.xl,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  actions: { gap: tokens.space.md },
  shareRow: { flexDirection: "row", gap: tokens.space.sm },
  shareButton: { flex: 1, paddingHorizontal: tokens.space.sm },
  feedback: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
  list: { borderBottomWidth: 1, borderTopWidth: 1, marginTop: tokens.space.sm },
  row: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, paddingVertical: tokens.space.lg },
  rowLabel: { flex: 1, fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  offscreen: { position: "absolute", top: 0 },
});
