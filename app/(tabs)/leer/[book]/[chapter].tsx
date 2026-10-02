import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppButton } from "../../../../src/components/AppButton";
import { AppScreen } from "../../../../src/components/AppScreen";
import { BottomPanel } from "../../../../src/components/BottomPanel";
import { Icon } from "../../../../src/components/Icon";
import { HeaderIconButton, ScreenHeader, goBackOrHome } from "../../../../src/components/ScreenHeader";
import { nextChapter, parseChapterParams, previousChapter, type ChapterRef } from "../../../../src/features/reading/chapterNavigation";
import { voiceForChapter } from "../../../../src/features/reading/chapterVoice";
import { highlightFill, type HighlightColor } from "../../../../src/features/reading/highlightColors";
import {
  dragOffset,
  enterOffset,
  markPageEnter,
  PAGE_TURN_MS,
  shouldClaimSwipe,
  shouldTurnPage,
  swipeDirection,
  takePageEnter,
  type SwipeDirection,
} from "../../../../src/features/reading/pageSwipe";
import { ReaderHint } from "../../../../src/features/reading/ReaderHint";
import { shouldShowReaderHint } from "../../../../src/features/reading/readerHint";
import { readLocalHintSeen, writeLocalHintSeen } from "../../../../src/features/reading/readerHintStorage";
import { ReaderPage, type MarginMark } from "../../../../src/features/reading/ReaderPage";
import { ReaderTextSettings } from "../../../../src/features/reading/ReaderTextSettings";
import {
  clampFontStep,
  clampSpacingStep,
  READING_FONT_SCALES,
  READING_LINE_SPACINGS,
  readingTypeStyle,
  stepTowards,
} from "../../../../src/features/reading/readingSettings";
import { NOTE_MAX_LENGTH, removeSavedCopy } from "../../../../src/features/reading/savedVerses";
import {
  overlayChapterBookmarks,
  overlayChapterHighlights,
  overlaySeparator,
} from "../../../../src/features/offline/mutationQueue";
import { useLocalChapter } from "../../../../src/features/offline/offlineBible";
import { READER_CHAPTER_UNAVAILABLE, READER_OFFLINE_NOTE } from "../../../../src/features/offline/offlineCopy";
import { useOfflineSync } from "../../../../src/features/offline/OfflineSyncProvider";
import { usePersistedQuery } from "../../../../src/features/offline/usePersistedQuery";
import { formatCitation } from "../../../../src/lib/citation";
import { formatVerseReference, type ReadingVerse } from "../../../../src/features/reading/shareVerse";
import type { VerseActionContext } from "../../../../src/features/reading/verseActions";
import { VerseToolbar } from "../../../../src/features/reading/VerseToolbar";
import { openPassage } from "../../../../src/lib/openPassage";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { tokens } from "../../../../src/theme/tokens";

function openReaderChapter(ref: ChapterRef, direction?: SwipeDirection) {
  if (direction) markPageEnter(direction);
  router.replace({ pathname: "/leer/[book]/[chapter]", params: { book: ref.book, chapter: String(ref.chapter) } });
}

export default function ReaderScreen() {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[]; verse?: string | string[] }>();
  const ref = parseChapterParams(params);
  // Sin conexión (#160): la cuenta, el separador y lo del capítulo salen de lo
  // último que se vio con señal; el texto, de la Biblia descargada.
  const currentUser = usePersistedQuery(api.users.current, {}, "users.current");
  const signedIn = Boolean(currentUser?._id);
  const version = currentUser?.bibleVersion ?? "RV1909";
  const requestedVerse = Number(Array.isArray(params.verse) ? params.verse[0] : params.verse);
  const chapterKey = ref ? `${ref.book}:${ref.chapter}` : null;
  // Si el capítulo está en el teléfono se lee de ahí, con o sin señal: no gasta
  // datos. Si no, se pide al servidor como siempre.
  const localVerses = useLocalChapter(ref ? { version, book: ref.book, chapter: ref.chapter } : null);
  const remoteVerses = useQuery(
    api.rag.verses.listByChapter,
    ref && localVerses === null ? { version, book: ref.book, chapter: ref.chapter } : "skip",
  );
  const verses = localVerses ?? remoteVerses;
  const saveProgress = useMutation(api.reading.saveProgress);
  const recordRecent = useMutation(api.reading.recordRecent);
  // Guardar, subrayar, separador y nota pasan por la cola (#182): se ven al
  // instante y se mandan en orden cuando hay red.
  const { online, pending, run } = useOfflineSync();
  // Guardados del capítulo desde el backend, no desde estado local: así quitar
  // un guardado desde la lista de Leer se ve también acá (#166).
  const chapterBookmarks = overlayChapterBookmarks(
    usePersistedQuery(
      api.reading.chapterBookmarks,
      ref && signedIn ? { book: ref.book, chapter: ref.chapter } : "skip",
      chapterKey && signedIn ? `chapterBookmarks:${chapterKey}` : null,
    ),
    pending,
    ref?.book ?? "",
    ref?.chapter ?? 0,
  );
  const separator = overlaySeparator(
    usePersistedQuery(api.reading.separator, signedIn ? {} : "skip", signedIn ? "separator" : null),
    pending,
  );
  const highlights = overlayChapterHighlights(
    usePersistedQuery(
      api.reading.highlightsForChapter,
      ref && signedIn ? { book: ref.book, chapter: ref.chapter } : "skip",
      chapterKey && signedIn ? `highlightsForChapter:${chapterKey}` : null,
    ),
    pending,
    ref?.book ?? "",
    ref?.chapter ?? 0,
  );
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [selected, setSelected] = useState<ReadingVerse | null>(null);
  // Borrador de la nota (#167). null = la hoja muestra las acciones; string =
  // la hoja muestra el campo de nota.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openedVerse = useRef<string | null>(null);

  // Pista de primera vez (#196): en la cuenta con sesión, en el teléfono sin ella.
  const [localHintSeen, setLocalHintSeen] = useState<boolean | undefined>(undefined);
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    if (currentUser !== null) return;
    let alive = true;
    void readLocalHintSeen().then((seen) => alive && setLocalHintSeen(seen));
    return () => {
      alive = false;
    };
  }, [currentUser]);
  const showHint = shouldShowReaderHint({
    user: currentUser === undefined ? undefined : currentUser && { _id: currentUser._id, readerHintSeen: currentUser.readerHintSeen },
    localSeen: localHintSeen,
    dismissed: hintDismissed,
  });
  const dismissHint = useCallback(() => {
    setHintDismissed(true);
    if (signedIn) void updatePreferences({ readerHintSeen: true }).catch(() => undefined);
    else void writeLocalHintSeen();
  }, [signedIn, updatePreferences]);

  const fontStep = clampFontStep(currentUser?.readingFontStep);
  const spacingStep = clampSpacingStep(currentUser?.readingSpacingStep);
  const typeStyle = useMemo(() => readingTypeStyle(fontStep, spacingStep), [fontStep, spacingStep]);
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

  // ── Scroll al versículo (#154) ─────────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pageY, setPageY] = useState<number | null>(null);
  const [verseTops, setVerseTops] = useState<Record<number, number>>({});
  const revealed = useRef<string | null>(null);

  // `?verse=N` abre la hoja de ese versículo (efecto de arriba); acá se hace
  // scroll hasta él cuando ya se midió su renglón. Lo mismo al tocar uno: la
  // hoja achica el área de lectura y el versículo no debe quedar tapado. Solo
  // se mueve si no se ve, así el versículo 1 no salta.
  useEffect(() => {
    if (!selected || pageY === null || viewportHeight === 0) return;
    const top = verseTops[selected.verse];
    if (top === undefined) return;
    const y = pageY + top;
    const hidden = y < scrollY.current || y + typeStyle.lineHeight > scrollY.current + viewportHeight;
    const key = `${selected.book}-${selected.chapter}-${selected.verse}-${viewportHeight}`;
    if (!hidden || revealed.current === key) return;
    revealed.current = key;
    // Un renglón de aire arriba para que se lea el versículo y la cinta.
    const target = Math.max(0, y - typeStyle.lineHeight);
    scrollY.current = target;
    scrollRef.current?.scrollTo({ y: target, animated: false });
  }, [pageY, selected, typeStyle.lineHeight, verseTops, viewportHeight]);

  // ── Pasar página deslizando (#195) ──────────────────────────────────────
  const translateX = useRef(new Animated.Value(0)).current;
  const pageOpacity = useRef(new Animated.Value(1)).current;
  // La página nueva entra desde el lado contrario. Va por capítulo (y no solo
  // al montar) por si `router.replace` reusa la pantalla con otros params: si
  // no, quedaría corrida y transparente donde terminó la salida.
  useLayoutEffect(() => {
    const enterFrom = takePageEnter();
    translateX.setValue(enterOffset(enterFrom, width));
    pageOpacity.setValue(enterFrom ? 0 : 1);
    if (!enterFrom) return;
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: PAGE_TURN_MS, useNativeDriver: true }),
      Animated.timing(pageOpacity, { toValue: 1, duration: PAGE_TURN_MS, useNativeDriver: true }),
    ]).start();
    // `width` no entra: rotar el teléfono no debe repetir la animación.
  }, [ref?.book, ref?.chapter, pageOpacity, translateX]);

  const neighbors = useRef({ previous, next, width });
  neighbors.current = { previous, next, width };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) => shouldClaimSwipe(gesture.dx, gesture.dy),
        onPanResponderMove: (_, gesture) => {
          const target = swipeDirection(gesture.dx) === "next" ? neighbors.current.next : neighbors.current.previous;
          translateX.setValue(dragOffset(gesture.dx, target !== null));
        },
        onPanResponderRelease: (_, gesture) => {
          const direction = swipeDirection(gesture.dx);
          const target = direction === "next" ? neighbors.current.next : neighbors.current.previous;
          if (target && shouldTurnPage(gesture.dx, gesture.vx, neighbors.current.width)) {
            const exit = direction === "next" ? -neighbors.current.width : neighbors.current.width;
            Animated.parallel([
              Animated.timing(translateX, { toValue: exit, duration: PAGE_TURN_MS, useNativeDriver: true }),
              Animated.timing(pageOpacity, { toValue: 0, duration: PAGE_TURN_MS, useNativeDriver: true }),
            ]).start(() => openReaderChapter(target, direction));
            return;
          }
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [pageOpacity, translateX],
  );

  // ── Estado de la página ─────────────────────────────────────────────────
  const separatorHere = (verse: { book: string; chapter: number; verse: number }) =>
    separator != null && separator.book === verse.book && separator.chapter === verse.chapter && separator.verse === verse.verse;
  const separatorElsewhere =
    separator != null && ref != null && (separator.book !== ref.book || separator.chapter !== ref.chapter);
  const separatorVerse = separator && ref && !separatorElsewhere ? separator.verse : null;
  // Subrayado (#168): como el resaltador de una Biblia de papel. Es gratis y
  // vive aparte del resaltado de búsqueda (`highlight.ts`), que solo marca
  // términos en los resultados del buscador.
  const highlightOf = (verse: number): HighlightColor | null =>
    highlights?.find((item) => item.verse === verse)?.color ?? null;
  const selectedHighlight = selected ? highlightOf(selected.verse) : null;
  const selectedBookmark = selected ? chapterBookmarks?.find((item) => item.verse === selected.verse) : undefined;

  const fills = useMemo(() => {
    const result: Record<number, string> = {};
    for (const item of highlights ?? []) result[item.verse] = highlightFill(color, item.color);
    // El versículo tocado se ve mientras la hoja está abierta (§U4).
    if (selected) result[selected.verse] = color.highlightSand;
    return result;
  }, [color, highlights, selected]);
  const highlightedVerses = useMemo(() => new Set((highlights ?? []).map((item) => item.verse)), [highlights]);
  const marks = useMemo(() => {
    const result: Record<number, MarginMark> = {};
    for (const item of chapterBookmarks ?? []) result[item.verse] = item.note ? "note" : "saved";
    return result;
  }, [chapterBookmarks]);

  const versesRef = useRef(verses);
  versesRef.current = verses;
  const hintRef = useRef({ showHint, dismissHint });
  hintRef.current = { showHint, dismissHint };
  const pressVerse = useCallback((number: number) => {
    const verse = versesRef.current?.find((item) => item.verse === number);
    if (!verse) return;
    if (hintRef.current.showHint) hintRef.current.dismissHint();
    setSettingsOpen(false);
    setSelected(verse);
    setNoteDraft(null);
  }, []);
  const separatorRef = useRef(separatorVerse);
  separatorRef.current = separatorVerse;
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const verseHint = useCallback((verse: number) => {
    if (separatorRef.current === verse) return "Acá está tu separador.";
    if (marksRef.current[verse] === "note") return "Versículo guardado con nota.";
    if (marksRef.current[verse] === "saved") return "Versículo guardado.";
    return undefined;
  }, []);

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
  const closeSheet = () => {
    setSelected(null);
    setNoteDraft(null);
  };
  // El separador es la cinta de una Biblia de papel: uno solo, y se queda donde
  // la persona lo puso (no se mueve con cada capítulo como "Seguí leyendo").
  const toggleSeparator = () => {
    if (!selected) return;
    run({
      kind: "separator",
      ref: separatorHere(selected) ? null : { book: selected.book, chapter: selected.chapter, verse: selected.verse },
    });
    setSelected(null);
  };
  const chooseHighlight = (key: HighlightColor) => {
    if (!selected) return;
    const target = { book: selected.book, chapter: selected.chapter, verse: selected.verse };
    run({ kind: "highlight", ref: target, color: selectedHighlight === key ? null : key });
  };
  const removeHighlight = () => {
    if (!selected) return;
    run({ kind: "highlight", ref: { book: selected.book, chapter: selected.chapter, verse: selected.verse }, color: null });
  };
  const saveSelected = () => {
    if (!selected) return;
    const target = { book: selected.book, chapter: selected.chapter, verse: selected.verse };
    const toggle = () => run({ kind: "bookmark", ref: target, saved: !selectedBookmark });
    // Quitar un guardado con nota borra la nota: se avisa antes (#167).
    if (selectedBookmark?.note) {
      const copy = removeSavedCopy(true);
      Alert.alert(copy.title, copy.body, [
        { text: "Cancelar", style: "cancel" },
        { text: "Quitar", style: "destructive", onPress: toggle },
      ]);
      return;
    }
    toggle();
  };
  // Guardar una nota también guarda el versículo; una nota vacía la borra y
  // deja el guardado (mismo contrato que `reading.saveBookmark`).
  const saveNote = (note: string) => {
    if (!selected) return;
    const trimmed = note.trim();
    run({
      kind: "bookmark",
      ref: { book: selected.book, chapter: selected.chapter, verse: selected.verse },
      saved: true,
      note: trimmed.length > 0 ? trimmed : null,
    });
    setNoteDraft(null);
  };
  const actionContext: VerseActionContext | null = selected
    ? {
        verse: selected,
        signedIn,
        saved: Boolean(selectedBookmark),
        hasNote: Boolean(selectedBookmark?.note),
        isSeparator: separatorHere(selected),
        referralCode: currentUser?.referralCode ?? null,
        voice: voiceForChapter(ref.book, ref.chapter),
        toggleSave: saveSelected,
        openNote: () => setNoteDraft(selectedBookmark?.note ?? ""),
        toggleSeparator,
      }
    : null;

  const sheetHeader = (full: boolean) =>
    selected ? (
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderText}>
          <Text style={[styles.panelTitle, { color: color.ink }]}>{formatCitation(selected)}</Text>
          <Text numberOfLines={2} style={[styles.panelQuote, { color: color.inkMuted }]}>{selected.text}</Text>
          {full && selectedBookmark?.note ? (
            <Text numberOfLines={2} style={[styles.panelNote, { backgroundColor: color.surfaceSunk, color: color.inkMuted }]}>
              {selectedBookmark.note}
            </Text>
          ) : null}
        </View>
        {full ? (
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            hitSlop={tokens.space.md}
            onPress={closeSheet}
            testID="reading-verse-actions-close"
          >
            <Icon color={color.inkSoft} name="close" />
          </Pressable>
        ) : null}
      </View>
    ) : null;

  return (
    <AppScreen contentStyle={styles.screen} style={{ backgroundColor: color.paper }}>
      <ScreenHeader
        center={
          <>
            <Text style={[styles.headerTitle, { color: color.inkSoft }]} testID="reading-title">
              {ref.book.toUpperCase()} · {ref.chapter}
            </Text>
            <Text style={[styles.version, { color: color.inkFaint }]}>{version}</Text>
          </>
        }
        onBack={goBackOrHome}
        style={styles.header}
        trailing={
          <HeaderIconButton
            accessibilityLabel="Tamaño de letra y espaciado"
            onPress={() => {
              setSelected(null);
              setSettingsOpen((open) => !open);
            }}
            testID="reading-text-settings"
          >
            <Icon color={color.ink} name="textSize" />
          </HeaderIconButton>
        }
      />

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.pager, { opacity: pageOpacity, transform: [{ translateX }] }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          ref={scrollRef}
          scrollEventThrottle={64}
        >
          {separatorElsewhere && separator ? (
            <Pressable
              accessibilityHint="Abre el capítulo donde dejaste tu separador."
              accessibilityRole="button"
              onPress={() => openPassage(separator)}
              style={({ pressed }) => [styles.separatorJump, { borderColor: color.border }, pressed && styles.pressed]}
              testID="reading-separator-jump"
            >
              <Icon color={color.accent} filled name="ribbon" size="sm" />
              <Text style={[styles.jumpLabel, { color: color.inkMuted }]}>
                Ir a tu separador · {separator.book} {separator.chapter}:{separator.verse}
              </Text>
            </Pressable>
          ) : null}

          {showHint && verses && verses.length > 0 ? (
            <View style={styles.inset}>
              <ReaderHint onDismiss={dismissHint} />
            </View>
          ) : null}

          {!online ? (
            <Text style={[styles.status, styles.inset, { color: color.inkSoft }]} testID="reading-offline-note">
              {READER_OFFLINE_NOTE}
            </Text>
          ) : null}
          {verses === undefined ? (
            <Text
              style={[styles.status, styles.inset, { color: color.inkSoft }]}
              testID={online ? undefined : "reading-chapter-unavailable"}
            >
              {online ? "Abriendo el capítulo…" : READER_CHAPTER_UNAVAILABLE}
            </Text>
          ) : null}
          {verses?.length === 0 ? (
            <Text style={[styles.status, styles.inset, { color: color.inkSoft }]}>
              Todavía no tenemos este capítulo en el corpus. Volvé a intentar cuando se haya indexado.
            </Text>
          ) : null}

          {verses && verses.length > 0 ? (
            <View onLayout={(event) => setPageY(event.nativeEvent.layout.y)}>
              <ReaderPage
                accessibilityHintFor={verseHint}
                chapter={ref.chapter}
                fills={fills}
                fontScale={READING_FONT_SCALES[fontStep]}
                highlighted={highlightedVerses}
                marks={marks}
                onPressVerse={pressVerse}
                onVerseTops={setVerseTops}
                separatorVerse={separatorVerse}
                typeStyle={typeStyle}
                verses={verses}
              />
            </View>
          ) : null}

          {/* Respaldo accesible del deslizar: al final del capítulo, no fijo. */}
          <View style={[styles.navigation, styles.inset]}>
            {previous ? (
              <Pressable
                accessibilityLabel={`Capítulo anterior, ${previous.book} ${previous.chapter}`}
                accessibilityRole="button"
                onPress={() => openReaderChapter(previous)}
                style={({ pressed }) => [styles.navButton, { borderColor: color.border }, pressed && styles.pressed]}
                testID="reading-previous-chapter"
              >
                <Icon color={color.inkSoft} name="back" size="sm" />
                <Text style={[styles.navLabel, { color: color.ink }]}>{previous.book} {previous.chapter}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {next ? (
              <Pressable
                accessibilityLabel={`Capítulo siguiente, ${next.book} ${next.chapter}`}
                accessibilityRole="button"
                onPress={() => openReaderChapter(next)}
                style={({ pressed }) => [styles.navButton, { borderColor: color.border }, pressed && styles.pressed]}
                testID="reading-next-chapter"
              >
                <Text style={[styles.navLabel, { color: color.ink }]}>{next.book} {next.chapter}</Text>
                <Icon color={color.inkSoft} name="chevronRight" size="sm" />
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </Animated.View>

      {settingsOpen && !selected ? (
        <ReaderTextSettings
          fontStep={fontStep}
          onClose={() => setSettingsOpen(false)}
          onFontStep={chooseFontStep}
          onSpacingStep={chooseSpacingStep}
          spacingStep={spacingStep}
        />
      ) : null}

      {selected && noteDraft !== null ? (
        <BottomPanel
          footer={
            <>
              <Text style={[styles.noteLabel, { color: color.accent }]}>TU NOTA · PRIVADA</Text>
              <TextInput
                accessibilityLabel={`Nota personal para ${formatVerseReference(selected)}`}
                autoFocus
                maxLength={NOTE_MAX_LENGTH}
                multiline
                onChangeText={setNoteDraft}
                placeholder="Por ejemplo: “Lo predicó el pastor el domingo”."
                placeholderTextColor={color.inkFaint}
                style={[styles.noteInput, { backgroundColor: color.surface, borderColor: color.accent, color: color.ink }]}
                testID="reading-note-input"
                textAlignVertical="top"
                value={noteDraft}
              />
              <Text style={[styles.noteCount, { color: color.inkFaint }]}>
                {noteDraft.length}/{NOTE_MAX_LENGTH} · No se comparte ni se envía a la IA.
              </Text>
              <AppButton
                disabled={noteDraft.trim().length === 0}
                onPress={() => saveNote(noteDraft)}
                testID="reading-note-save"
              >
                Guardar nota
              </AppButton>
              {selectedBookmark?.note ? (
                <AppButton onPress={() => saveNote("")} testID="reading-note-delete" variant="quiet">
                  Borrar nota
                </AppButton>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => setNoteDraft(null)} style={styles.cancel}>
                <Text style={[styles.cancelLabel, { color: color.inkSoft }]}>Cancelar</Text>
              </Pressable>
            </>
          }
          header={sheetHeader(false)}
          testID="reading-note-editor"
        />
      ) : selected && actionContext ? (
        <BottomPanel header={sheetHeader(true)} testID="reading-verse-actions">
          <VerseToolbar
            context={actionContext}
            highlight={
              signedIn ? { selected: selectedHighlight, choose: chooseHighlight, clear: removeHighlight } : undefined
            }
          />
        </BottomPanel>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // La página va de borde a borde: los márgenes los pone `readerPadding`.
  screen: { paddingBottom: 0, paddingHorizontal: 0, paddingTop: tokens.space.md },
  header: { paddingBottom: tokens.space.sm, paddingHorizontal: tokens.screenPadding.horizontal },
  headerTitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  version: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  error: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  pager: { flex: 1 },
  scrollContent: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl, paddingTop: tokens.readerPadding.top },
  inset: { marginHorizontal: tokens.readerPadding.horizontal },
  pressed: { opacity: tokens.opacity.pressed },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  separatorJump: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    marginHorizontal: tokens.readerPadding.horizontal,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  jumpLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  navigation: { flexDirection: "row", gap: tokens.space.sm, justifyContent: "space-between", marginTop: tokens.space.xl },
  navButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  navLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
  sheetHeader: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.md },
  sheetHeaderText: { flex: 1, gap: tokens.space.xs },
  panelTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  panelQuote: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
  },
  // Nota personal (#167): mismo campo que "Escríbelo con tus palabras" de
  // Sentir y mismo fondo `surfaceSunk` que la nota en la tarjeta de guardados.
  panelNote: {
    borderRadius: tokens.radius.md,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    overflow: "hidden",
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  cancel: { paddingVertical: tokens.space.xs },
  cancelLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size, textAlign: "center" },
  noteLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  noteInput: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    maxHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  noteCount: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
