import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

export default function VocesScreen() {
  const { color } = useTheme();
  const characters = useQuery(api.voices.list);

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <Text style={[styles.title, { color: color.ink }]}>¿Con quién quieres hablar?</Text>
      <Text style={[styles.subtitle, { color: color.inkMuted }]}>
        Responden en primera persona, desde lo que la Biblia cuenta de su vida.
      </Text>

      <View style={styles.list}>
        {characters?.map((character) => (
          <Pressable
            accessibilityRole="button"
            key={character.slug}
            onPress={() => router.push(`/voces/${character.slug}`)}
            style={[styles.row, { backgroundColor: color.surface, borderColor: color.border }]}
          >
            <LinearGradient colors={[character.gradientFrom, character.gradientTo]} style={styles.avatar}>
              <Text style={[styles.avatarInitial, { color: color.avatarInitial }]}>{character.name[0]}</Text>
            </LinearGradient>
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: color.ink }]}>{character.name}</Text>
              <Text style={[styles.tag, { color: color.inkSoft }]}>{character.tag}</Text>
            </View>
            <Text style={[styles.chevron, { color: color.inkFaint }]}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.notice, { backgroundColor: color.surfaceSunk }]}>
        <Text style={[styles.noticeText, { color: color.inkSoft }]}>
          Solo personajes humanos. De Dios, Jesús y el Espíritu Santo hablamos en tercera persona, siempre.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xs,
  },
  list: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  row: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  avatar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.avatar,
    justifyContent: "center",
    width: tokens.size.avatar,
  },
  avatarInitial: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  rowText: { flex: 1 },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  tag: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  chevron: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  notice: { borderRadius: tokens.radius.md, marginTop: tokens.space.xxl, paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  noticeText: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
