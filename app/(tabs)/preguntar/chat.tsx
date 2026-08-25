import { useAction, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../../convex/_generated/api";
import { QUOTA_LIMITS } from "../../../convex/quotas";
import { shareQaAnswer } from "../../../src/features/qa/shareAnswer";
import { tokens } from "../../../src/theme/tokens";

const QA_LIMIT_BODY = `Usaste tus ${QUOTA_LIMITS.qa} preguntas gratis de hoy. Vuelven mañana a las 6:00 a.m.`;

function QaLimitScreen() {
  return (
    <LinearGradient colors={[tokens.color.surface, tokens.color.surfaceSunk]} style={styles.limitScreen}>
      <View style={styles.limitIcon}>
        <Text style={styles.limitIconMark}>◷</Text>
      </View>
      <Text style={styles.limitTitle}>Por hoy llegaste al límite</Text>
      <Text style={styles.limitBody}>{QA_LIMIT_BODY}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/paywall")} style={styles.limitCta} testID="qa-limit-paywall">
        <Text style={styles.limitCtaLabel}>Seguir sin límite con Pro</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} testID="qa-limit-home">
        <Text style={styles.limitSkip}>Mañana vuelvo</Text>
      </Pressable>
    </LinearGradient>
  );
}

export default function PreguntarChatScreen() {
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{contextLabel}</Text>
            {quotaLabel ? <Text style={styles.quota}>{quotaLabel}</Text> : null}
          </View>
        </View>

        {atLimit ? (
          <QaLimitScreen />
        ) : (
          <>
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
                    {message.role === "assistant" && message.citation && message.question ? (
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
                        <Text style={styles.shareIcon}>↗</Text>
                        <Text style={styles.shareLabel}>Compartir esta respuesta</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
              {busy ? <Text style={styles.typing}>Buscando en el texto…</Text> : null}
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
          </>
        )}
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
  headerText: { flex: 1 },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  quota: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginTop: tokens.space.xs },
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
  share: {
    alignItems: "center",
    borderTopColor: tokens.color.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md
  },
  shareIcon: { color: tokens.color.sage, fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  shareLabel: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  typing: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
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
  sendIcon: { color: tokens.color.surface, fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  limitScreen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.space.xxl + tokens.space.lg
  },
  limitIcon: {
    alignItems: "center",
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar
  },
  limitIconMark: { color: tokens.color.accent, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  limitTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xxl
  },
  limitBody: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg
  },
  limitCta: {
    backgroundColor: tokens.color.ink,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.cardPadding.vertical
  },
  limitCtaLabel: {
    color: tokens.color.surface,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center"
  },
  limitSkip: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    marginTop: tokens.space.md,
    textAlign: "center"
  }
});
