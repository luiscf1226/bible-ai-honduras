import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { useLocalChapter } from "../../../src/features/offline/offlineBible";
import { usePersistedQuery } from "../../../src/features/offline/usePersistedQuery";
import { parseChapterParams } from "../../../src/features/reading/chapterNavigation";
import {
  CROSS_REFERENCE_ATTRIBUTION,
  crossReferencesFor,
  formatCrossReference,
  passageVerses,
  type CrossReference,
} from "../../../src/features/reading/crossReferences";
import { openPassage } from "../../../src/lib/openPassage";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

type ChapterVerse = { verse: number; text: string };

/**
 * Pasajes relacionados de un versículo (#187, N4). Se llega desde la hoja del
 * versículo en el lector ("Relacionados"). Las referencias salen de un índice
 * fijo (OpenBible.info / TSK); el texto de cada pasaje, de la misma Biblia que
 * el lector: la descargada si está en el teléfono, si no, el servidor.
 *
 * Tocar un pasaje abre el lector en ese versículo.
 */
export default function RelacionadosScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[]; verse?: string | string[] }>();
  const chapterRef = parseChapterParams(params);
  const verse = Number(Array.isArray(params.verse) ? params.verse[0] : params.verse);
  const source = chapterRef && Number.isInteger(verse) && verse > 0 ? { ...chapterRef, verse } : null;
  const currentUser = usePersistedQuery(api.users.current, {}, "users.current");
  const version = currentUser?.bibleVersion ?? "RV1909";
  const related = useMemo(() => (source ? crossReferencesFor(source) : []), [source?.book, source?.chapter, source?.verse]);
  const sourceVerses = useChapterVerses(version, source);
  const sourceText = source ? sourceVerses?.find((item) => item.verse === source.verse)?.text : undefined;

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Pasajes relacionados" titleSize="pick" />

      {source ? (
        <View style={styles.source} testID="related-source">
          <Text style={[styles.overline, { color: color.accent }]}>RELACIONADOS CON</Text>
          <Text style={[styles.sourceReference, { color: color.ink }]}>
            {source.book} {source.chapter}:{source.verse}
          </Text>
          {sourceText ? (
            <Text numberOfLines={3} style={[styles.sourceText, { color: color.inkMuted }]}>
              “{sourceText}”
            </Text>
          ) : null}
        </View>
      ) : null}

      {related.length === 0 ? (
        <Text style={[styles.status, { color: color.inkSoft }]} testID="related-empty">
          Este versículo no tiene pasajes relacionados en el índice.
        </Text>
      ) : (
        <View style={styles.list}>
          {related.map((ref) => (
            <RelatedPassageCard item={ref} key={formatCrossReference(ref)} version={version} />
          ))}
        </View>
      )}

      <Text style={[styles.attribution, { color: color.inkFaint }]}>{CROSS_REFERENCE_ATTRIBUTION}</Text>
    </AppScreen>
  );
}

/** Capítulo desde el teléfono si está descargado; si no, del servidor. */
function useChapterVerses(version: string, ref: { book: string; chapter: number } | null): ChapterVerse[] | undefined {
  const local = useLocalChapter(ref ? { version, book: ref.book, chapter: ref.chapter } : null);
  const remote = useQuery(
    api.rag.verses.listByChapter,
    ref && local === null ? { version, book: ref.book, chapter: ref.chapter } : "skip",
  );
  return local ?? remote;
}

function RelatedPassageCard({ item, version }: { item: CrossReference; version: string }) {
  const { color } = useTheme();
  const chapter = useChapterVerses(version, item);
  const verses = chapter ? passageVerses(item, chapter) : undefined;
  const reference = formatCrossReference(item);

  return (
    <Pressable
      accessibilityHint="Abre el pasaje en el lector."
      accessibilityLabel={reference}
      accessibilityRole="button"
      onPress={() => openPassage({ book: item.book, chapter: item.chapter, verse: item.verse })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.surface, borderColor: color.border },
        pressed && styles.pressed,
      ]}
      testID="related-passage"
    >
      <Text style={[styles.overline, { color: color.accent }]}>{reference.toUpperCase()}</Text>
      {verses === undefined ? (
        <Text style={[styles.status, { color: color.inkFaint }]}>Abriendo el pasaje…</Text>
      ) : verses.length === 0 ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>
          Este pasaje todavía no está en {version}. Tocá para abrir el capítulo.
        </Text>
      ) : (
        <Text numberOfLines={5} style={[styles.passage, { color: color.ink }]}>
          {verses.map((entry, index) => (
            <Text key={entry.verse}>
              {verses.length > 1 ? <Text style={[styles.verseNumber, { color: color.accent }]}>{entry.verse} </Text> : null}
              {entry.text}
              {index < verses.length - 1 ? " " : ""}
            </Text>
          ))}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  source: { gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  sourceReference: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  sourceText: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  list: { gap: tokens.space.md },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, gap: tokens.space.md, padding: tokens.space.xl },
  pressed: { opacity: tokens.opacity.pressed },
  passage: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  verseNumber: { fontFamily: tokens.font.sans, fontSize: tokens.type.verseNumber.size },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  attribution: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
