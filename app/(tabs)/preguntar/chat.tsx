import { useAction, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../../convex/_generated/api";
import { LimitReached } from "../../../src/components/LimitReached";
import { shareQaAnswer } from "../../../src/features/qa/shareAnswer";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

const QA_SUGGESTIONS = ["¿Quién lo escribió?", "¿Cómo lo aplico hoy?", "Explícalo más simple"] as const;

export default function PreguntarChatScreen() {
  const { color } = useTheme();
  const { book, chapter, verse } = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  const thread = useQuery(api.qa.thread, {});
  const currentUser = useQuery(api.users.current);
  const quota = useQuery(api.quotas.remaining, currentUser ? { module: "qa" } : "skip");
  const ask = useAction(api.qa.ask);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const contextLabel = book
    ? `${book}${chapter ? ` ${chapter}` : ""}${verse ? `:${verse}` : ""}`
    : "Pregunta libre";

  const quotaLabel = !quota ? null : quota.isPro ? "Pro · sin límite" : `${quota.remaining} de ${quota.limit} preguntas gratis hoy`;

  const messages = useMemo(
    () =>
      (thread ?? []).map((message, index) => ({
        key: message._id,
        role: message.role,
        text: message.text,
        citation: message.citations?.[0] ?? null,
        question: message.role === "assistant" ? (thread ?? [])[index - 1]?.text ?? null : null,
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

  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);

  if (atLimit) {
    return <LimitReached module="qa" testID="qa-limit" />;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={[styles.header, { borderBottomColor: color.border, backgroundColor: color.surface }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.back, { borderColor: color.border }]}
          >
            <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: color.ink }]}>{contextLabel}</Text>
            {quotaLabel ? <Text style={[styles.quota, { color: color.inkSoft }]}>{quotaLabel}</Text> : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.thread}>
          {messages.length === 0 ? (
            <Text style={[styles.empty, { color: color.inkSoft }]}>
              Preguntá lo que quieras sobre el texto. Las respuestas siempre citan un versículo.
            </Text>
          ) : null}
          {messages.map((message) => (
            <View
              key={message.key}
              style={[styles.bubbleWrap, message.role === "user" ? styles.bubbleWrapUser : styles.bubbleWrapAi]}
            >
              <View
                style={[
                  styles.bubble,
                  message.role === "user"
                    ? { backgroundColor: color.ink, borderColor: color.ink }
                    : { backgroundColor: color.surface, borderColor: color.border },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    message.role === "user"
                      ? { color: color.surface, fontFamily: tokens.font.sans }
                      : { color: color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.aiBubble.size, lineHeight: tokens.type.aiBubble.lineHeight },
                  ]}
                >
                  {message.text}
                </Text>
                {message.citation ? (
                  <View style={[styles.citation, { backgroundColor: color.surfaceSunk }]}>
                    <Text style={[styles.citationQuote, { color: color.inkMuted }]}>&ldquo;{message.citation.text}&rdquo;</Text>
                    <Text style={[styles.citationRef, { color: color.inkFaint }]}>
                      {message.citation.book} {message.citation.chapter}:{message.citation.verse} ({message.citation.version})
                    </Text>
                  </View>
                ) : null}
                {message.role === "assistant" && message.citation && message.question ? (
                  <View style={[styles.shareRow, { borderTopColor: color.border }]}>
                    <Pressable
                      accessibilityHint={
                        currentUser?.referralCode
                          ? "Abre las opciones para compartir esta respuesta."
                          : "Esperá mientras cargamos tu perfil."
                      }
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !currentUser?.referralCode }}
                      disabled={!currentUser?.referralCode}
                      onPress={() => {
                        if (!currentUser?.referralCode || !message.citation || !message.question) {
                          return;
                        }
                        void shareQaAnswer({
                          question: message.question,
                          citation: message.citation,
                          referralCode: currentUser.referralCode,
                        });
                      }}
                      style={styles.share}
                      testID="qa-share-answer"
                    >
                      <Text style={[styles.shareIcon, { color: color.sage }]}>↗</Text>
                      <Text style={[styles.shareLabel, { color: color.inkMuted }]}>Compartir</Text>
                    </Pressable>
                    <Text style={[styles.disclaimer, { color: color.inkFaint }]}>La IA puede equivocarse</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {busy ? <Text style={[styles.typing, { color: color.inkFaint }]}>Buscando en el texto…</Text> : null}
        </ScrollView>

        <View style={[styles.composer, { borderTopColor: color.border, backgroundColor: color.surface }]}>
          <ScrollView horizontal contentContainerStyle={styles.suggestions} showsHorizontalScrollIndicator={false}>
            {QA_SUGGESTIONS.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={suggestion}
                onPress={() => void onSend(suggestion)}
                style={[styles.suggestion, { backgroundColor: color.surface, borderColor: color.borderStrong }]}
              >
                <Text style={[styles.suggestionLabel, { color: color.inkSoft }]}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.inputRow, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
            <TextInput
              onChangeText={setDraft}
              onSubmitEditing={() => void onSend(draft)}
              placeholder="Escribe tu pregunta…"
              placeholderTextColor={color.inkFaint}
              style={[styles.input, { color: color.ink }]}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void onSend(draft)}
              style={[styles.send, { backgroundColor: color.ink }]}
            >
              <Text style={[styles.sendIcon, { color: color.surface }]}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  back: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  backIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  headerText: { flex: 1 },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  quota: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginTop: tokens.space.xxs },
  thread: { gap: tokens.space.lg, padding: tokens.cardPadding.horizontal },
  empty: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  bubbleWrap: { flexDirection: "row" },
  bubbleWrapUser: { justifyContent: "flex-end" },
  bubbleWrapAi: { justifyContent: "flex-start" },
  bubble: { borderRadius: tokens.radius.xl, borderWidth: 1, maxWidth: "88%", padding: tokens.space.lg },
  bubbleText: { fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  citation: { borderRadius: tokens.radius.md, marginTop: tokens.space.lg, padding: tokens.space.lg },
  citationQuote: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.body.size,
    fontStyle: "italic",
    lineHeight: tokens.type.body.lineHeight,
  },
  citationRef: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginTop: tokens.space.sm },
  shareRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xl,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  share: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  shareIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  shareLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.disclaimer.size },
  disclaimer: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.disclaimer.size },
  typing: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
  composer: { borderTopWidth: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  suggestions: { gap: tokens.space.sm, paddingBottom: tokens.space.md },
  suggestion: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  suggestionLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.chip.size },
  inputRow: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  input: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  send: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.sendButton,
    justifyContent: "center",
    width: tokens.size.sendButton,
  },
  sendIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
});
