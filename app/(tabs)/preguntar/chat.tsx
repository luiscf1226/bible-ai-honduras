import { useAction, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../../convex/_generated/api";
import { tokens } from "../../../src/theme/tokens";

export default function PreguntarChatScreen() {
  const { book, chapter, verse } = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  const thread = useQuery(api.qa.thread, {});
  const ask = useAction(api.qa.ask);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const contextLabel = book
    ? `${book}${chapter ? ` ${chapter}` : ""}${verse ? `:${verse}` : ""}`
    : "Pregunta libre";

  const messages = useMemo(
    () =>
      (thread ?? []).map((message) => ({
        key: message._id,
        role: message.role,
        text: message.text,
        citation: message.citations?.[0] ?? null,
      })),
    [thread],
  );

  const onSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }
    setDraft("");
    setBusy(true);
    try {
      const passage = book
        ? { book, chapter: Number(chapter), verse: verse ? Number(verse) : undefined }
        : undefined;
      const result = await ask({ question: trimmed, passage });
      if (result.status === "limit_reached") {
        setLimitReached(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{contextLabel}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.thread}>
          {messages.length === 0 ? (
            <Text style={styles.empty}>Preguntá lo que quieras sobre el texto. Las respuestas siempre citan un versículo.</Text>
          ) : null}
          {messages.map((message) => (
            <View key={message.key} style={[styles.bubbleWrap, message.role === "user" ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
              <View style={[styles.bubble, message.role === "user" ? styles.bubbleUser : styles.bubbleAi]}>
                <Text style={[styles.bubbleText, message.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAi]}>
                  {message.text}
                </Text>
                {message.citation ? (
                  <View style={styles.citation}>
                    <Text style={styles.citationQuote}>&ldquo;{message.citation.text}&rdquo;</Text>
                    <Text style={styles.citationRef}>
                      {message.citation.book} {message.citation.chapter}:{message.citation.verse} ({message.citation.version})
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {busy ? <Text style={styles.typing}>Buscando en el texto…</Text> : null}
          {limitReached ? (
            <Text style={styles.limit}>Usaste tus preguntas gratis de hoy. Vuelven mañana.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <TextInput
              onChangeText={setDraft}
              onSubmitEditing={() => void onSend(draft)}
              placeholder="Escribe tu pregunta…"
              placeholderTextColor={tokens.color.inkFaint}
              style={styles.input}
              value={draft}
            />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void onSend(draft)} style={styles.send}>
              <Text style={styles.sendIcon}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: tokens.color.surface, flex: 1 },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomColor: tokens.color.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg
  },
  back: {
    alignItems: "center",
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  backIcon: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  thread: { gap: tokens.space.lg, padding: tokens.cardPadding.horizontal },
  empty: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  bubbleWrap: { flexDirection: "row" },
  bubbleWrapUser: { justifyContent: "flex-end" },
  bubbleWrapAi: { justifyContent: "flex-start" },
  bubble: { borderRadius: tokens.radius.xl, borderWidth: 1, maxWidth: "88%", padding: tokens.space.lg },
  bubbleUser: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
  bubbleAi: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border },
  bubbleText: { fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bubbleTextUser: { color: tokens.color.surface, fontFamily: tokens.font.sans },
  bubbleTextAi: { color: tokens.color.ink, fontFamily: tokens.font.serif },
  citation: { backgroundColor: tokens.color.surfaceSunk, borderRadius: tokens.radius.md, marginTop: tokens.space.lg, padding: tokens.space.lg },
  citationQuote: { color: tokens.color.inkMuted, fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, fontStyle: "italic", lineHeight: tokens.type.body.lineHeight },
  citationRef: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginTop: tokens.space.sm },
  typing: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
  limit: { color: tokens.color.accent, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
  composer: { borderTopColor: tokens.color.border, borderTopWidth: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  inputRow: {
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm
  },
  input: { color: tokens.color.ink, flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  send: {
    alignItems: "center",
    backgroundColor: tokens.color.ink,
    borderRadius: tokens.radius.pill,
    height: tokens.size.logoSmall - tokens.space.sm,
    justifyContent: "center",
    width: tokens.size.logoSmall - tokens.space.sm
  },
  sendIcon: { color: tokens.color.surface, fontFamily: tokens.font.sans, fontSize: tokens.type.body.size }
});
