import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { Icon } from "../../src/components/Icon";
import { ConversationSwitcher } from "../../src/features/navigation/ConversationSwitcher";
import { FeaturedCharacterCard } from "../../src/features/voices/FeaturedCharacterCard";
import { withPressed } from "../../src/theme/pressed";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";
import { RequiresConnection } from "../../src/features/offline/RequiresConnection";

function VocesScreenContent() {
  const { color } = useTheme();
  const characters = useQuery(api.voices.list);

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <View style={styles.header}>
        <ConversationSwitcher current="voces" flush />
      </View>
      <Text style={[styles.title, { color: color.ink }]}>¿Con quién quieres hablar?</Text>
      <Text style={[styles.subtitle, { color: color.inkMuted }]}>
        Responden en primera persona, desde lo que la Biblia cuenta de su vida.
      </Text>

      <View style={styles.list}>
        {/* Personaje del mes (#200): arriba de la lista; la lista no cambia. */}
        <FeaturedCharacterCard />
        {characters?.map((character) => (
          <Pressable
            accessibilityRole="button"
            key={character.slug}
            onPress={() => router.push(`/voces/${character.slug}`)}
            style={withPressed(styles.row, { backgroundColor: color.surface, borderColor: color.border })}
          >
            <LinearGradient colors={[character.gradientFrom, character.gradientTo]} style={styles.avatar}>
              <Text style={[styles.avatarInitial, { color: color.avatarInitial }]}>{character.name[0]}</Text>
            </LinearGradient>
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: color.ink }]}>{character.name}</Text>
              <Text style={[styles.tag, { color: color.inkSoft }]}>{character.tag}</Text>
            </View>
            <Icon color={color.inkFaint} name="chevronRight" size="sm" />
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
  header: { marginBottom: tokens.space.xl },
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
  notice: { borderRadius: tokens.radius.md, marginTop: tokens.space.xxl, paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  noticeText: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});

/** Sin señal no puede responder: se avisa en vez de quedarse cargando (#160). */
export default function VocesScreen() {
  return (
    <RequiresConnection module="voices">
      <VocesScreenContent />
    </RequiresConnection>
  );
}
