import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme/tokens";

// Color del inicial sobre el degradé de cada personaje — tomado tal cual del
// prototipo (avatarFor(), estilo "circle"). No hay token semántico para un
// overlay translúcido sobre fondos de color variable.
const AVATAR_INITIAL_COLOR = "rgba(255,255,255,0.9)";

export default function VocesScreen() {
  const characters = useQuery(api.voices.list);

  return (
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>¿Con quién quieres hablar?</Text>
      <Text style={styles.subtitle}>Responden en primera persona, desde lo que la Biblia cuenta de su vida.</Text>

      <View style={styles.list}>
        {characters?.map((character) => (
          <Pressable
            accessibilityRole="button"
            key={character.slug}
            onPress={() => router.push(`/voces/${character.slug}`)}
            style={styles.row}
          >
            <LinearGradient
              colors={[character.gradientFrom, character.gradientTo]}
              style={styles.avatar}
            >
              <Text style={styles.avatarInitial}>{character.name[0]}</Text>
            </LinearGradient>
            <View style={styles.rowText}>
              <Text style={styles.name}>{character.name}</Text>
              <Text style={styles.tag}>{character.tag}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Solo personajes humanos. De Dios, Jesús y el Espíritu Santo hablamos en tercera persona, siempre.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: 0 },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  subtitle: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  list: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  row: {
    alignItems: "center",
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical
  },
  avatar: { alignItems: "center", borderRadius: tokens.radius.pill, height: tokens.size.avatar, justifyContent: "center", width: tokens.size.avatar },
  avatarInitial: { color: AVATAR_INITIAL_COLOR, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  rowText: { flex: 1 },
  name: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  tag: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  chevron: { color: tokens.color.inkFaint, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  notice: { backgroundColor: tokens.color.surfaceSunk, borderRadius: tokens.radius.md, marginTop: tokens.space.xxl, paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  noticeText: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight }
});
