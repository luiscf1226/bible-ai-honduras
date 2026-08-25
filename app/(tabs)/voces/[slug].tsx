import { useAction, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { QUOTA_LIMITS } from "../../../convex/quotas";
import { shareVoiceReply } from "../../../src/features/voices/shareVoice";
import { tokens } from "../../../src/theme/tokens";

const AVATAR_INITIAL_COLOR = "rgba(255,255,255,0.9)";

const VOICES_LIMIT_BODY = `Usaste tus ${QUOTA_LIMITS.voices} conversaciones gratis de hoy. Vuelven mañana a las 6:00 a.m., y el devocional del día sigue abierto para ti.`;

function VoicesLimitScreen() {
  return (
    <LinearGradient colors={[tokens.color.surface, tokens.color.surfaceSunk]} style={styles.limit}>
      <View style={styles.limitIcon}>
        <Text style={styles.limitIconMark}>◷</Text>
      </View>
      <Text style={styles.limitTitle}>Por hoy llegaste al límite</Text>
      <Text style={styles.limitBody}>{VOICES_LIMIT_BODY}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/paywall")}
        style={styles.limitCta}
        testID="voices-limit-paywall"
      >
        <Text style={styles.limitCtaLabel}>Seguir sin límite con Pro</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/home")} testID="voices-limit-home">
        <Text style={styles.limitSkip}>Mañana vuelvo</Text>
      </Pressable>
    </LinearGradient>
  );
}

export default function VocesChatScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const characters = useQuery(api.voices.list);
  const character = characters?.find((item) => item.slug === slug);
  const thread = useQuery(api.voices.thread, slug ? { slug } : "skip");
  const currentUser = useQuery(api.users.current);
  const quota = useQuery(api.quotas.remaining, currentUser ? { module: "voices" } : "skip");
  const sendMessage = useAction(api.voices.sendMessage);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const messages = useMemo(() => {
    if (!character) {
      return [];
    }
    if (thread && thread.length > 0) {
      return thread.map((message) => ({
        key: message._id,
        role: message.role,
        text: message.text,
      }));
    }
    return [{ key: "first", role: "assistant" as const, text: character.first }];
  }, [character, thread]);

  if (characters && !character) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Ese personaje no está en Voces.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLabel}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!character) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={tokens.color.accent} />
      </SafeAreaView>
    );
  }

  const onSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !slug) {
      return;
    }
    setDraft("");
    setBusy(true);
    try {
      const result = await sendMessage({ slug, text: trimmed });
      if (result.status === "limit_reached") {
        setLimitReached(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);
  if (atLimit) {
    return (
      <SafeAreaView style={styles.safe} testID="voices-limit">
        <VoicesLimitScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <LinearGradient colors={[character.gradientFrom, character.gradientTo]} style={styles.avatar}>
            <Text style={styles.avatarInitial}>{character.name[0]}</Text>
          </LinearGradient>
          <View style={styles.headerText}>
            <Text style={styles.name}>{character.name}</Text>
            <Text style={styles.tag}>{character.tag}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.thread}>
          {messages.map((message) => (
            <View
              key={message.key}
              style={[styles.bubbleWrap, message.role === "user" ? styles.bubbleWrapUser : styles.bubbleWrapAi]}
            >
              <View style={[styles.bubble, message.role === "user" ? styles.bubbleUser : styles.bubbleAi]}>
                <Text style={[styles.bubbleText, message.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAi]}>
                  {message.text}
                </Text>
                {message.role === "assistant" ? (
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
                      if (!currentUser?.referralCode) {
                        return;
                      }
                      void shareVoiceReply({
                        characterName: character.name,
                        referralCode: currentUser.referralCode,
                        reply: message.text,
                      });
                    }}
                    style={styles.share}
                    testID="voices-share-reply"
                  >
                    <Text style={styles.shareIcon}>↗</Text>
                    <Text style={styles.shareLabel}>Compartir esta respuesta</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {busy ? <Text style={styles.typing}>{character.name} está escribiendo…</Text> : null}
        </ScrollView>

        <View style={styles.composer}>
          <ScrollView horizontal contentContainerStyle={styles.suggestions} showsHorizontalScrollIndicator={false}>
            {character.suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={suggestion}
                onPress={() => void onSend(suggestion)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionLabel}>{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              onChangeText={setDraft}
              onSubmitEditing={() => void onSend(draft)}
              placeholder="Pregúntale algo…"
              placeholderTextColor={tokens.color.inkFaint}
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void onSend(draft)}
              style={styles.send}
            >
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
  missing: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    margin: tokens.space.xl,
  },
  backLabel: { color: tokens.color.accent, fontFamily: tokens.font.sans, marginHorizontal: tokens.space.xl },
  header: {
    alignItems: "center",
    borderBottomColor: tokens.color.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  back: {
    alignItems: "center",
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.dotActive + tokens.space.md,
    justifyContent: "center",
    width: tokens.size.dotActive + tokens.space.md,
  },
  backIcon: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  avatar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.logoSmall,
    justifyContent: "center",
    width: tokens.size.logoSmall,
  },
  avatarInitial: { color: AVATAR_INITIAL_COLOR, fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  headerText: { flex: 1 },
  name: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  tag: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    marginTop: tokens.space.xs,
  },
  thread: { gap: tokens.space.lg, padding: tokens.cardPadding.horizontal },
  bubbleWrap: { flexDirection: "row" },
  bubbleWrapUser: { justifyContent: "flex-end" },
  bubbleWrapAi: { justifyContent: "flex-start" },
  bubble: { borderRadius: tokens.radius.xl, borderWidth: 1, maxWidth: "88%", padding: tokens.space.lg },
  bubbleUser: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
  bubbleAi: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border },
  bubbleText: { fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bubbleTextUser: { color: tokens.color.surface, fontFamily: tokens.font.sans },
  bubbleTextAi: { color: tokens.color.ink, fontFamily: tokens.font.serif },
  share: {
    alignItems: "center",
    borderTopColor: tokens.color.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  shareIcon: { color: tokens.color.sage, fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  shareLabel: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
  },
  typing: {
    color: tokens.color.inkFaint,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    paddingVertical: tokens.space.sm,
  },
  composer: {
    borderTopColor: tokens.color.border,
    borderTopWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  suggestions: { gap: tokens.space.sm, paddingBottom: tokens.space.md },
  suggestion: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  suggestionLabel: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size },
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
    paddingVertical: tokens.space.sm,
  },
  input: { color: tokens.color.ink, flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  send: {
    alignItems: "center",
    backgroundColor: tokens.color.ink,
    borderRadius: tokens.radius.pill,
    height: tokens.size.logoSmall - tokens.space.sm,
    justifyContent: "center",
    width: tokens.size.logoSmall - tokens.space.sm,
  },
  sendIcon: { color: tokens.color.surface, fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
  limit: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.space.xxl + tokens.space.lg,
  },
  limitIcon: {
    alignItems: "center",
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar,
  },
  limitIconMark: { color: tokens.color.accent, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  limitTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xxl,
  },
  limitBody: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  limitCta: {
    backgroundColor: tokens.color.ink,
    borderRadius: tokens.radius.lg,
    marginTop: tokens.space.xxl + tokens.space.sm,
    paddingVertical: tokens.cardPadding.vertical,
  },
  limitCtaLabel: {
    color: tokens.color.surface,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    textAlign: "center",
  },
  limitSkip: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    marginTop: tokens.space.md,
    textAlign: "center",
  },
});
