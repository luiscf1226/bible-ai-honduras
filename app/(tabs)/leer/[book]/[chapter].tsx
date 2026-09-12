import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppScreen } from "../../../../src/components/AppScreen";
import { BottomPanel } from "../../../../src/components/BottomPanel";
import { ScreenHeader, goBackOrHome } from "../../../../src/components/ScreenHeader";
import { nextChapter, parseChapterParams, previousChapter } from "../../../../src/features/reading/chapterNavigation";
import { buildVerseCopyText, formatVerseReference, shareVerse, type ReadingVerse } from "../../../../src/features/reading/shareVerse";
import {
  clampFontStep,
  clampSpacingStep,
  READING_FONT_LABELS,
  READING_FONT_SCALES,
  READING_LINE_SPACINGS,
  READING_SPACING_LABELS,
  readingTypeStyle,
  stepTowards,
} from "../../../../src/features/reading/readingSettings";
import { copyToClipboard } from "../../../../src/lib/clipboard";
import { goToChat } from "../../../../src/lib/goToChat";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { tokens } from "../../../../src/theme/tokens";

function openReaderChapter(ref: { book: string; chapter: number }) {
  router.replace({ pathname: "/leer/[book]/[chapter]", params: { book: ref.book, chapter: String(ref.chapter) } });
}

export default function ReaderScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[]; verse?: string | string[] }>();
  const ref = parseChapterParams(params);
  const currentUser = useQuery(api.users.current);
  const version = currentUser?.bibleVersion ?? "RV1909";
  const requestedVerse = Number(Array.isArray(params.verse) ? params.verse[0] : params.verse);
  const verses = useQuery(
    api.rag.verses.listByChapter,
    ref ? { version, book: ref.book, chapter: ref.chapter } : "skip",
  );
  const saveProgress = useMutation(api.reading.saveProgress);
  const recordRecent = useMutation(api.reading.recordRecent);
  const toggleBookmark = useMutation(api.reading.toggleBookmark);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [selected, setSelected] = useState<ReadingVerse | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const openedVerse = useRef<string | null>(null);

  const fontStep = clampFontStep(currentUser?.readingFontStep);
  const spacingStep = clampSpacingStep(currentUser?.readingSpacingStep);
  const typeStyle = readingTypeStyle(fontStep, spacingStep);
  const previous = ref ? previousChapter(ref) : null;
  const next = ref ? nextChapter(ref) : null;

  useEffect(() => {
    if (!ref || !currentUser?._id) return;
    // El marcador y Recientes son por cuenta; la lectura sin sesión sigue
    // gratis, pero no intenta persistir una identidad inexistente.
    void saveProgress({ book: ref.book, chapter: ref.chapter }).catch(() => undefined);
    void recordRecent({ book: ref.book, chapter: ref.chapter }).catch(() => undefined);
  }, [currentUser?._id, recordRecent, ref?.book, ref?.chapter, saveProgress]);

  useEffect(() => {
    if (!ref || !Number.isInteger(requestedVerse) || requestedVerse < 1 || !verses) return;
    const key = `${ref.book}-${ref.chapter}-${requestedVerse}`;
    if (openedVerse.current === key) return;
    const verse = verses.find((item) => item.verse === requestedVerse);
    if (verse) {
      openedVerse.current = key;
      setSelected(verse);
    }
  }, [ref?.book, ref?.chapter, requestedVerse, verses]);

  if (!ref) {
    return (
      <AppScreen>
        <ScreenHeader onBack={goBackOrHome} title="Lectura" />
        <Text style={[styles.error, { color: color.inkSoft }]}>Ese capítulo no existe. Elegí un libro y un capítulo válidos.</Text>
      </AppScreen>
    );
  }

  const chooseFontStep = (direction: 1 | -1) => {
    const nextStep = stepTowards(fontStep, direction, READING_FONT_SCALES.length);
    void updatePreferences({ readingFontStep: nextStep }).catch(() => undefined);
  };
  const chooseSpacingStep = (direction: 1 | -1) => {
    const nextStep = stepTowards(spacingStep, direction, READING_LINE_SPACINGS.length);
    void updatePreferences({ readingSpacingStep: nextStep }).catch(() => undefined);
  };
  const selectVerse = (verse: ReadingVerse) => {
    setSelected(verse);
    setSaved(null);
  };
  const askAboutSelected = () => {
    if (!selected) return;
    goToChat(selected);
  };
  const shareSelected = () => {
    if (!selected || !currentUser?.referralCode) return;
    void shareVerse({ verse: selected, referralCode: currentUser.referralCode });
  };
  const copySelected = () => {
    if (!selected) return;
    void copyToClipboard(buildVerseCopyText(selected));
  };
  const saveSelected = async () => {
    if (!selected) return;
    const result = await toggleBookmark({ book: selected.book, chapter: selected.chapter, verse: selected.verse });
    setSaved(result.saved);
  };

  return (
    <AppScreen contentStyle={styles.screen}>
      <ScreenHeader onBack={goBackOrHome} title={`${ref.book} ${ref.chapter}`} titleSize="pick" />
      <Text style={[styles.version, { color: color.inkSoft }]}>{version}</Text>

      <View style={styles.controls}>
        <Text style={[styles.controlLabel, { color: color.inkSoft }]}>TAMAÑO: {READING_FONT_LABELS[fontStep]}</Text>
        <View style={styles.controlButtons}>
          <Pressable accessibilityLabel="Reducir tamaño de letra" accessibilityRole="button" onPress={() => chooseFontStep(-1)} style={[styles.controlButton, { borderColor: color.border }]}><Text style={[styles.controlText, { color: color.ink }]}>A−</Text></Pressable>
          <Pressable accessibilityLabel="Aumentar tamaño de letra" accessibilityRole="button" onPress={() => chooseFontStep(1)} style={[styles.controlButton, { borderColor: color.border }]}><Text style={[styles.controlText, { color: color.ink }]}>A+</Text></Pressable>
        </View>
        <Text style={[styles.controlLabel, { color: color.inkSoft }]}>ESPACIADO: {READING_SPACING_LABELS[spacingStep]}</Text>
        <View style={styles.controlButtons}>
          <Pressable accessibilityLabel="Reducir interlineado" accessibilityRole="button" onPress={() => chooseSpacingStep(-1)} style={[styles.controlButton, { borderColor: color.border }]}><Text style={[styles.controlText, { color: color.ink }]}>−</Text></Pressable>
          <Pressable accessibilityLabel="Aumentar interlineado" accessibilityRole="button" onPress={() => chooseSpacingStep(1)} style={[styles.controlButton, { borderColor: color.border }]}><Text style={[styles.controlText, { color: color.ink }]}>+</Text></Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.verseList} keyboardShouldPersistTaps="handled">
        {verses === undefined ? <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo el capítulo…</Text> : null}
        {verses?.length === 0 ? <Text style={[styles.status, { color: color.inkSoft }]}>Todavía no tenemos este capítulo en el corpus. Volvé a intentar cuando se haya indexado.</Text> : null}
        {verses?.map((verse) => (
          <Pressable accessibilityRole="button" key={verse.verse} onPress={() => selectVerse(verse)} style={({ pressed }) => [styles.verseRow, pressed && styles.pressed]}>
            <Text style={[styles.verseNumber, { color: color.accent }]}>{verse.verse}</Text>
            <Text style={[styles.verseText, typeStyle, { color: color.ink }]}>{verse.text}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.navigation}>
        <Pressable accessibilityRole="button" disabled={!previous} onPress={() => previous && openReaderChapter(previous)} style={[styles.navButton, { borderColor: color.border }, !previous && styles.disabled]}><Text style={[styles.navLabel, { color: color.ink }]}>‹ Anterior</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!next} onPress={() => next && openReaderChapter(next)} style={[styles.navButton, { borderColor: color.border }, !next && styles.disabled]}><Text style={[styles.navLabel, { color: color.ink }]}>Siguiente ›</Text></Pressable>
      </View>

      {selected ? (
        <BottomPanel
          header={<><Text style={[styles.panelTitle, { color: color.ink }]}>{formatVerseReference(selected)}</Text><Text style={[styles.panelQuote, { color: color.inkSoft }]}>{selected.text}</Text></>}
          testID="reading-verse-actions"
        >
          <Pressable accessibilityRole="button" onPress={askAboutSelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Preguntar sobre esto</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!currentUser?.referralCode} onPress={shareSelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Compartir</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void saveSelected()} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>{saved ? "Guardado" : "Guardar"}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={copySelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Copiar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={styles.action}><Text style={[styles.actionLabel, { color: color.inkSoft }]}>Cancelar</Text></Pressable>
        </BottomPanel>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: tokens.space.lg, paddingBottom: tokens.space.lg },
  error: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  version: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginLeft: tokens.size.backButton + tokens.space.md, marginTop: -tokens.space.xl },
  controls: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  controlLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  controlButtons: { flexDirection: "row", gap: tokens.space.xs },
  controlButton: { borderRadius: tokens.radius.pill, borderWidth: 1, paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xxs },
  controlText: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  verseList: { gap: tokens.space.sm, paddingBottom: tokens.space.lg },
  verseRow: { flexDirection: "row", gap: tokens.space.md, paddingVertical: tokens.space.sm },
  pressed: { opacity: tokens.opacity.pressed },
  verseNumber: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, minWidth: tokens.space.xl },
  verseText: { flex: 1, fontFamily: tokens.font.serif },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  navigation: { flexDirection: "row", gap: tokens.space.sm, justifyContent: "space-between" },
  navButton: { borderRadius: tokens.radius.lg, borderWidth: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  navLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
  disabled: { opacity: tokens.opacity.pressed },
  panelTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  panelQuote: { fontFamily: tokens.font.serif, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  action: { paddingVertical: tokens.space.xs },
  actionLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
});
