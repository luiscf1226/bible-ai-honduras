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
import { tokens } from "../../../src/theme/tokens";

const AVATAR_INITIAL_COLOR = "rgba(255,255,255,0.9)";

export default function VocesChatScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const characters = useQuery(api.voices.list);
  const character = characters?.find((item) => item.slug === slug);
  const thread = useQuery(api.voices.thread, slug ? { slug } : "skip");
  const sendMessage = useAction(api.voices.sendMessage);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

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
      await sendMessage({ slug, text: trimmed });
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
});
