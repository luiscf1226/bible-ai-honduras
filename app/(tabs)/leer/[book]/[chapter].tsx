import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { AppButton } from "../../../../src/components/AppButton";
import { AppScreen } from "../../../../src/components/AppScreen";
import { BottomPanel } from "../../../../src/components/BottomPanel";
import { ScreenHeader, goBackOrHome } from "../../../../src/components/ScreenHeader";
import { nextChapter, parseChapterParams, previousChapter } from "../../../../src/features/reading/chapterNavigation";
import { voiceDraftFor, voiceForChapter } from "../../../../src/features/reading/chapterVoice";
import { HIGHLIGHT_SWATCHES, highlightFill, type HighlightColor } from "../../../../src/features/reading/highlightColors";
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
import { copyToClipboard } from "../../../../src/lib/clipboard";
import { goToChat } from "../../../../src/lib/goToChat";
import { goToVoices } from "../../../../src/lib/goToVoices";
import { openPassage } from "../../../../src/lib/openPassage";
import { track } from "../../../../src/lib/telemetry";
import { useTheme } from "../../../../src/theme/ThemeProvider";
import { tokens } from "../../../../src/theme/tokens";

function openReaderChapter(ref: { book: string; chapter: number }) {
  router.replace({ pathname: "/leer/[book]/[chapter]", params: { book: ref.book, chapter: String(ref.chapter) } });
}

export default function ReaderScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[]; verse?: string | string[] }>();
  const ref = parseChapterParams(params);
  // Sin conexión (#160): la cuenta, el separador y lo del capítulo salen de lo
  // último que se vio con señal; el texto, de la Biblia descargada.
  const currentUser = usePersistedQuery(api.users.current, {}, "users.current");
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
      ref && currentUser?._id ? { book: ref.book, chapter: ref.chapter } : "skip",
      chapterKey && currentUser?._id ? `chapterBookmarks:${chapterKey}` : null,
    ),
    pending,
    ref?.book ?? "",
    ref?.chapter ?? 0,
  );
  const separator = overlaySeparator(
    usePersistedQuery(api.reading.separator, currentUser?._id ? {} : "skip", currentUser?._id ? "separator" : null),
    pending,
  );
  const highlights = overlayChapterHighlights(
    usePersistedQuery(
      api.reading.highlightsForChapter,
      ref && currentUser?._id ? { book: ref.book, chapter: ref.chapter } : "skip",
      chapterKey && currentUser?._id ? `highlightsForChapter:${chapterKey}` : null,
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
    setNoteDraft(null);
  };
  const closeSheet = () => {
    setSelected(null);
    setNoteDraft(null);
  };
  const selectedBookmark = selected ? chapterBookmarks?.find((item) => item.verse === selected.verse) : undefined;
  const askAboutSelected = () => {
    if (!selected) return;
    goToChat(selected);
  };
  // Puente Lectura → Voces: si el capítulo lo vivió o lo escribió un personaje
  // del catálogo, se ofrece hablar con él sobre este versículo. Voces sigue
  // pasando por su cuota (regla dura #3); acá solo se navega.
  const chapterVoice = voiceForChapter(ref.book, ref.chapter);
  const talkAboutSelected = () => {
    if (!selected || !chapterVoice) return;
    track("reader_voice_opened");
    goToVoices(chapterVoice.slug, {
      draft: voiceDraftFor(`${selected.book} ${selected.chapter}:${selected.verse}`, chapterVoice.role),
    });
  };
  const shareSelected = () => {
    if (!selected || !currentUser?.referralCode) return;
    void shareVerse({ verse: selected, referralCode: currentUser.referralCode });
  };
  const copySelected = () => {
    if (!selected) return;
    void copyToClipboard(buildVerseCopyText(selected));
  };
  // El separador es la cinta de una Biblia de papel: uno solo, y se queda donde
  // la persona lo puso (no se mueve con cada capítulo como "Seguí leyendo").
  const separatorHere = (verse: { book: string; chapter: number; verse: number }) =>
    separator != null && separator.book === verse.book && separator.chapter === verse.chapter && separator.verse === verse.verse;
  const separatorElsewhere =
    separator != null && ref != null && (separator.book !== ref.book || separator.chapter !== ref.chapter);
  const toggleSeparator = () => {
    if (!selected) return;
    run({
      kind: "separator",
      ref: separatorHere(selected) ? null : { book: selected.book, chapter: selected.chapter, verse: selected.verse },
    });
    setSelected(null);
  };
  // Subrayado (#168): como el resaltador de una Biblia de papel. Es gratis y
  // vive aparte del resaltado de búsqueda (`highlight.ts`), que solo marca
  // términos en los resultados del buscador.
  const highlightOf = (verse: number): HighlightColor | null =>
    highlights?.find((item) => item.verse === verse)?.color ?? null;
  const selectedHighlight = selected ? highlightOf(selected.verse) : null;
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

  return (
    <AppScreen contentStyle={styles.screen}>
      <ScreenHeader onBack={goBackOrHome} title={`${ref.book} ${ref.chapter}`} titleSize="pick" />
      <Text style={[styles.version, { color: color.inkSoft }]}>{version}</Text>
      {!online ? (
        <Text style={[styles.status, { color: color.inkSoft }]} testID="reading-offline-note">
          {READER_OFFLINE_NOTE}
        </Text>
      ) : null}

      {separatorElsewhere && separator ? (
        <Pressable
          accessibilityHint="Abre el capítulo donde dejaste tu separador."
          accessibilityRole="button"
          onPress={() => openPassage(separator)}
          style={({ pressed }) => [styles.separatorJump, { borderColor: color.border }, pressed && styles.pressed]}
          testID="reading-separator-jump"
        >
          <View style={[styles.separatorRibbon, { backgroundColor: color.accent }]} />
          <Text style={[styles.controlLabel, { color: color.inkMuted }]}>
            Ir a tu separador · {separator.book} {separator.chapter}:{separator.verse}
          </Text>
        </Pressable>
      ) : null}

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
        {verses === undefined ? (
          <Text style={[styles.status, { color: color.inkSoft }]} testID={online ? undefined : "reading-chapter-unavailable"}>
            {online ? "Abriendo el capítulo…" : READER_CHAPTER_UNAVAILABLE}
          </Text>
        ) : null}
        {verses?.length === 0 ? <Text style={[styles.status, { color: color.inkSoft }]}>Todavía no tenemos este capítulo en el corpus. Volvé a intentar cuando se haya indexado.</Text> : null}
        {verses?.map((verse) => {
          const marked = separatorHere(verse);
          const highlight = highlightOf(verse.verse);
          return (
            <View key={verse.verse}>
              {marked ? (
                <View style={styles.separatorMark} testID="reading-separator-mark">
                  <View style={[styles.separatorRibbon, { backgroundColor: color.accent }]} />
                  <Text style={[styles.separatorLabel, { color: color.accent }]}>TU SEPARADOR</Text>
                </View>
              ) : null}
              <Pressable
                accessibilityHint={marked ? "Acá está tu separador." : highlight ? "Versículo subrayado." : undefined}
                accessibilityRole="button"
                onPress={() => selectVerse(verse)}
                style={({ pressed }) => [styles.verseRow, pressed && styles.pressed]}
              >
                <Text style={[styles.verseNumber, { color: color.accent }]}>{verse.verse}</Text>
                <Text style={[styles.verseText, typeStyle, { color: color.ink }]}>
                  {/* Texto anidado: el fondo sigue cada renglón como un resaltador, no un bloque. */}
                  {highlight ? (
                    <Text style={{ backgroundColor: highlightFill(color, highlight) }} testID={`reading-highlighted-verse-${verse.verse}`}>
                      {verse.text}
                    </Text>
                  ) : (
                    verse.text
                  )}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.navigation}>
        <Pressable accessibilityRole="button" disabled={!previous} onPress={() => previous && openReaderChapter(previous)} style={[styles.navButton, { borderColor: color.border }, !previous && styles.disabled]}><Text style={[styles.navLabel, { color: color.ink }]}>‹ Anterior</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!next} onPress={() => next && openReaderChapter(next)} style={[styles.navButton, { borderColor: color.border }, !next && styles.disabled]}><Text style={[styles.navLabel, { color: color.ink }]}>Siguiente ›</Text></Pressable>
      </View>

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
              <Pressable accessibilityRole="button" onPress={() => setNoteDraft(null)} style={styles.action}>
                <Text style={[styles.actionLabel, styles.centered, { color: color.inkSoft }]}>Cancelar</Text>
              </Pressable>
            </>
          }
          header={
            <>
              <Text style={[styles.panelTitle, { color: color.ink }]}>{formatVerseReference(selected)}</Text>
              <Text numberOfLines={2} style={[styles.panelQuote, { color: color.inkSoft }]}>{selected.text}</Text>
            </>
          }
          testID="reading-note-editor"
        />
      ) : selected ? (
        <BottomPanel
          header={
            <>
              <Text style={[styles.panelTitle, { color: color.ink }]}>{formatVerseReference(selected)}</Text>
              <Text style={[styles.panelQuote, { color: color.inkSoft }]}>{selected.text}</Text>
              {selectedBookmark?.note ? (
                <Text numberOfLines={3} style={[styles.panelNote, { backgroundColor: color.surfaceSunk, color: color.inkMuted }]}>
                  {selectedBookmark.note}
                </Text>
              ) : null}
            </>
          }
          testID="reading-verse-actions"
        >
          <Pressable accessibilityRole="button" onPress={askAboutSelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Preguntar sobre esto</Text></Pressable>
          {chapterVoice ? (
            <Pressable
              accessibilityHint={`Abre Voces con ${chapterVoice.name} y deja escrito este versículo.`}
              accessibilityRole="button"
              onPress={talkAboutSelected}
              style={styles.action}
              testID="reading-talk-to-voice"
            >
              <Text style={[styles.actionLabel, { color: color.ink }]}>Hablar con {chapterVoice.name}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" disabled={!currentUser?.referralCode} onPress={shareSelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Compartir</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={saveSelected} style={styles.action} testID="reading-save-toggle"><Text style={[styles.actionLabel, { color: color.ink }]}>{selectedBookmark ? "Guardado" : "Guardar"}</Text></Pressable>
          {currentUser?._id ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNoteDraft(selectedBookmark?.note ?? "")}
              style={styles.action}
              testID="reading-note-open"
            >
              <Text style={[styles.actionLabel, { color: color.ink }]}>{selectedBookmark?.note ? "Editar nota" : "Agregar nota"}</Text>
            </Pressable>
          ) : null}
          {currentUser?._id ? (
            <View style={[styles.action, styles.highlightRow]} testID="reading-highlight-picker">
              <Text style={[styles.actionLabel, { color: color.ink }]}>Subrayar</Text>
              <View style={styles.swatches}>
                {HIGHLIGHT_SWATCHES.map((swatch) => {
                  const active = selectedHighlight === swatch.key;
                  return (
                    <Pressable
                      accessibilityLabel={active ? `Quitar subrayado ${swatch.label}` : `Subrayar en ${swatch.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      hitSlop={tokens.space.xs}
                      key={swatch.key}
                      onPress={() => chooseHighlight(swatch.key)}
                      style={[styles.swatchRing, { borderColor: active ? color.ink : color.surface }]}
                      testID={`reading-highlight-${swatch.key}`}
                    >
                      <View style={[styles.swatch, { backgroundColor: color[swatch.swatch] }]} />
                    </Pressable>
                  );
                })}
              </View>
              {selectedHighlight ? (
                <Pressable accessibilityRole="button" onPress={removeHighlight} testID="reading-highlight-clear">
                  <Text style={[styles.controlLabel, { color: color.inkSoft }]}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {currentUser?._id ? (
            <Pressable accessibilityRole="button" onPress={toggleSeparator} style={styles.action} testID="reading-separator-toggle">
              <Text style={[styles.actionLabel, { color: color.ink }]}>
                {separatorHere(selected) ? "Quitar el separador" : "Poner el separador aquí"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={copySelected} style={styles.action}><Text style={[styles.actionLabel, { color: color.ink }]}>Copiar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={closeSheet} style={styles.action}><Text style={[styles.actionLabel, { color: color.inkSoft }]}>Cancelar</Text></Pressable>
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
  // Separador: misma cinta que la tarjeta de `leer/index.tsx`.
  separatorRibbon: { borderRadius: tokens.radius.pill, height: tokens.space.lg, width: tokens.size.dot },
  separatorMark: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm, marginLeft: tokens.space.xl + tokens.space.md },
  separatorLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  separatorJump: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  actionLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  // Selector de subrayado: puntos del ancho del indicador de página activa,
  // con un anillo del grosor del borde de las tarjetas para el color activo.
  highlightRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  swatches: { flexDirection: "row", gap: tokens.space.sm },
  swatchRing: { borderRadius: tokens.radius.pill, borderWidth: 1, padding: tokens.space.xxs },
  swatch: { borderRadius: tokens.radius.pill, height: tokens.size.dotActive, width: tokens.size.dotActive },
  centered: { textAlign: "center" },
  // Nota personal (#167): mismo campo que "Escríbelo con tus palabras" de
  // Sentir y mismo fondo `surfaceSunk` que la nota en la tarjeta de guardados.
  panelNote: {
    borderRadius: tokens.radius.md,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    overflow: "hidden",
    padding: tokens.space.md,
  },
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
