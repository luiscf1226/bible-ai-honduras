import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { BIBLE_BOOKS, chaptersFor } from "../../src/lib/bibleBooks";
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

export default function PreguntarScreen() {
  const [step, setStep] = useState<Step>("books");
  const [book, setBook] = useState<string | null>(null);
  const [chapter, setChapter] = useState<number | null>(null);
  const currentUser = useQuery(api.users.current);
  const verses = useQuery(
    api.rag.verses.listByChapter,
    book && chapter ? { version: currentUser?.bibleVersion ?? "RVR1960", book, chapter } : "skip",
  );

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
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={back} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {step === "books" ? "Elige un libro" : step === "chapters" ? "Elige un capítulo" : "Elige un versículo"}
        </Text>
      </View>

      {step === "books" ? (
        <>
          <View style={styles.list}>
            {BIBLE_BOOKS.map((entry, index) => (
              <Pressable
                accessibilityRole="button"
                key={entry.name}
                onPress={() => {
                  setBook(entry.name);
                  setStep("chapters");
                }}
                style={[styles.row, index === BIBLE_BOOKS.length - 1 && styles.rowLast]}
              >
                <Text style={styles.rowLabel}>{entry.name}</Text>
                <Text style={styles.rowMeta}>{entry.chapters} capítulos</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => goToChat({})} style={styles.freeButton}>
            <Text style={styles.freeButtonLabel}>Prefiero preguntar directo, sin elegir pasaje</Text>
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
              style={styles.chapterCell}
            >
              <Text style={styles.chapterLabel}>{n}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === "verses" && book && chapter ? (
        <>
          {verses === undefined ? null : verses.length === 0 ? (
            <View style={styles.emptyVerses}>
              <Text style={styles.emptyVersesText}>
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
                  <Text style={styles.verseNumber}>{item.verse}</Text>
                  <Text style={styles.verseText}>{item.text}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable accessibilityRole="button" onPress={() => goToChat({ book, chapter })} style={styles.askButton}>
            <Text style={styles.askButtonLabel}>Preguntar sobre {book} {chapter}</Text>
          </Pressable>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: 0, paddingBottom: tokens.space.xxl },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, marginBottom: tokens.space.xxl },
  backButton: { alignItems: "center", borderColor: tokens.color.border, borderRadius: tokens.radius.pill, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  backIcon: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  list: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: { alignItems: "center", borderBottomColor: tokens.color.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  rowMeta: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  freeButton: { borderColor: tokens.color.borderStrong, borderRadius: tokens.radius.lg, borderStyle: "dashed", borderWidth: 1, marginTop: tokens.space.xl, paddingVertical: tokens.cardPadding.vertical },
  freeButtonLabel: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, textAlign: "center" },
  chapterGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chapterCell: { alignItems: "center", backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.md, borderWidth: 1, height: 52, justifyContent: "center", width: "18%" },
  chapterLabel: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  emptyVerses: { backgroundColor: tokens.color.surfaceSunk, borderRadius: tokens.radius.md, padding: tokens.cardPadding.horizontal },
  emptyVersesText: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  verseList: { gap: 2 },
  verseRow: { flexDirection: "row", gap: tokens.space.md, paddingVertical: tokens.space.md },
  verseNumber: { color: tokens.color.accent, fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, minWidth: 16 },
  verseText: { color: tokens.color.ink, flex: 1, fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  askButton: { backgroundColor: tokens.color.ink, borderRadius: tokens.radius.lg, marginTop: tokens.space.xl, paddingVertical: tokens.cardPadding.vertical },
  askButtonLabel: { color: tokens.color.surface, fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, textAlign: "center" }
});
