import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { BIBLE_BOOKS, chaptersFor } from "../../src/lib/bibleBooks";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

type Step = "books" | "chapters" | "verses";

function goToChat(params: { book?: string; chapter?: number; verse?: number }) {
  router.push({ pathname: "/preguntar/chat", params: toStringParams(params) });
}

function toStringParams(params: { book?: string; chapter?: number; verse?: number }) {
  const result: Record<string, string> = {};
  if (params.book) result.book = params.book;
  if (params.chapter !== undefined) result.chapter = String(params.chapter);
  if (params.verse !== undefined) result.verse = String(params.verse);
  return result;
}

function pickTitle(step: Step, book: string | null, chapter: number | null) {
  if (step === "books") return "¿Sobre qué pasaje?";
  if (step === "chapters") return book ?? "";
  return book && chapter ? `${book} ${chapter}` : "";
}

function pickSubtitle(step: Step) {
  if (step === "books") return "Elige un libro, o pregunta directo sin pasaje.";
  if (step === "chapters") return "Elige el capítulo.";
  return "Toca los versículos sobre los que quieres preguntar.";
}

export default function PreguntarScreen() {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>("books");
  const [book, setBook] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const currentUser = useQuery(api.users.current);
  const verses = useQuery(
    api.rag.verses.listByChapter,
    book && chapter ? { version: currentUser?.bibleVersion ?? "RVR1960", book, chapter } : "skip",
  );

  const chapterCellSize = useMemo(() => {
    const horizontalPadding = tokens.screenPadding.horizontal * 2;
    const gaps = tokens.space.sm * (tokens.grid.chapterColumns - 1);
    return (width - horizontalPadding - gaps) / tokens.grid.chapterColumns;
  }, [width]);

  const back = () => {
    if (step === "verses") {
      setStep("chapters");
      return;
    }
    if (step === "chapters") {
      setStep("books");
      setBook(null);
      return;
    }
    router.replace("/home");
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={back}
          style={[styles.backButton, { borderColor: color.border }]}
        >
          <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: color.ink }]}>{pickTitle(step, book, chapter)}</Text>
      </View>
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>{pickSubtitle(step)}</Text>

      {step === "books" ? (
        <>
          <View style={[styles.list, { backgroundColor: color.surface, borderColor: color.border }]}>
            {BIBLE_BOOKS.map((entry, index) => (
              <Pressable
                accessibilityRole="button"
                key={entry.name}
                onPress={() => {
                  setBook(entry.name);
                  setStep("chapters");
                }}
                style={[
                  styles.row,
                  { borderBottomColor: color.border },
                  index === BIBLE_BOOKS.length - 1 && styles.rowLast,
                ]}
              >
                <Text style={[styles.rowLabel, { color: color.ink }]}>{entry.name}</Text>
                <Text style={[styles.rowMeta, { color: color.inkFaint }]}>{entry.chapters} capítulos</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => goToChat({})}
            style={[styles.freeButton, { borderColor: color.borderStrong }]}
          >
            <Text style={[styles.freeButtonLabel, { color: color.inkSoft }]}>
              Prefiero preguntar directo, sin elegir pasaje
            </Text>
          </Pressable>
        </>
      ) : null}

      {step === "chapters" && book ? (
        <View style={styles.chapterGrid}>
          {Array.from({ length: chaptersFor(book) }, (_, index) => index + 1).map((n) => (
            <Pressable
              accessibilityRole="button"
              key={n}
              onPress={() => {
                setChapter(n);
                setStep("verses");
              }}
              style={[
                styles.chapterCell,
                {
                  backgroundColor: color.surface,
                  borderColor: color.border,
                  height: chapterCellSize,
                  width: chapterCellSize,
                },
              ]}
            >
              <Text style={[styles.chapterLabel, { color: color.ink }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === "verses" && book && chapter ? (
        <>
          {verses === undefined ? null : verses.length === 0 ? (
            <View style={[styles.emptyVerses, { backgroundColor: color.surfaceSunk }]}>
              <Text style={[styles.emptyVersesText, { color: color.inkSoft }]}>
                Todavía no tenemos versículos indexados de {book} {chapter}. Podés preguntar sobre el capítulo igual.
              </Text>
            </View>
          ) : (
            <View style={styles.verseList}>
              {verses.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.verse}
                  onPress={() => goToChat({ book, chapter, verse: item.verse })}
                  style={styles.verseRow}
                >
                  <Text style={[styles.verseNumber, { color: color.accent }]}>{item.verse}</Text>
                  <Text style={[styles.verseText, { color: color.ink }]}>{item.text}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => goToChat({ book, chapter })}
            style={[styles.askButton, { backgroundColor: color.ink }]}
          >
            <Text style={[styles.askButtonLabel, { color: color.surface }]}>
              Preguntar sobre {book} {chapter}
            </Text>
          </Pressable>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0, paddingBottom: tokens.space.xxl },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, marginBottom: tokens.space.xs },
  backButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  backIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.qaPickTitle.size,
    lineHeight: tokens.type.qaPickTitle.lineHeight,
  },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginBottom: tokens.space.xxl,
    marginLeft: tokens.size.backButton + tokens.space.md,
  },
  list: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  rowMeta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  freeButton: {
    borderRadius: tokens.radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    marginTop: tokens.space.xl,
    paddingVertical: tokens.cardPadding.vertical,
  },
  freeButtonLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, textAlign: "center" },
  chapterGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chapterCell: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
  },
  chapterLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  emptyVerses: { borderRadius: tokens.radius.md, padding: tokens.cardPadding.horizontal },
  emptyVersesText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  verseList: { gap: tokens.space.xxs },
  verseRow: { flexDirection: "row", gap: tokens.space.md, paddingVertical: tokens.space.lg },
  verseNumber: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, minWidth: tokens.space.lg },
  verseText: {
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
  },
  askButton: { borderRadius: tokens.radius.lg, marginTop: tokens.space.xl, paddingVertical: tokens.cardPadding.vertical },
  askButtonLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, textAlign: "center" },
});
