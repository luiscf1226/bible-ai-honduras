import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text } from "react-native";

import { api } from "../../../convex/_generated/api";
import { openPassage } from "../../lib/openPassage";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { useLocalChapter } from "../offline/offlineBible";
import { formatCrossReference, passageVerses, type CrossReference } from "./crossReferences";

export type ChapterVerse = { verse: number; text: string };

/** Capítulo desde el teléfono si está descargado; si no, del servidor. */
export function useChapterVerses(
  version: string,
  ref: { book: string; chapter: number } | null,
): ChapterVerse[] | undefined {
  const local = useLocalChapter(ref ? { version, book: ref.book, chapter: ref.chapter } : null);
  const remote = useQuery(
    api.rag.verses.listByChapter,
    ref && local === null ? { version, book: ref.book, chapter: ref.chapter } : "skip",
  );
  return local ?? remote;
}

/**
 * Un pasaje con su texto, leído de la misma Biblia que el lector. Tocar abre
 * el lector en ese versículo. Lo usan los pasajes relacionados (#187) y los
 * versículos por tema: una sola tarjeta, mismos tokens.
 */
export function PassageCard({ item, testID, version }: { item: CrossReference; testID: string; version: string }) {
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
      testID={testID}
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
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, gap: tokens.space.md, padding: tokens.space.xl },
  pressed: { opacity: tokens.opacity.pressed },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  passage: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  verseNumber: { fontFamily: tokens.font.sans, fontSize: tokens.type.verseNumber.size },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
