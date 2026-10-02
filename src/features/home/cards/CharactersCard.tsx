import { useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { goToVoices } from "../../../lib/goToVoices";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { CHARACTERS_CARD_CAPTION, HOME_ROUTES, pickHomeCharacters } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Tarjeta 5, Personajes de la Biblia (U1): 4 avatares del catálogo de Voces,
 * con el mismo degradado + inicial de `voces.tsx`. Tocar un avatar abre esa
 * conversación; la tarjeta, el catálogo. Voces no cambia por dentro.
 */
export function CharactersCard() {
  const { color } = useTheme();
  const characters = useQuery(api.voices.list);
  const shown = pickHomeCharacters(characters ?? []);

  return (
    <HomeCard
      accessibilityHint="Abre la lista de personajes."
      caption={CHARACTERS_CARD_CAPTION}
      icon="voice"
      onPress={() => openFromHome(HOME_ROUTES.characters)}
      testID="home-card-characters"
      title="Personajes de la Biblia"
    >
      {shown.length > 0 ? (
        <View style={styles.row}>
          {shown.map((character) => (
            <Pressable
              accessibilityHint={`Abre la conversación con ${character.name}.`}
              accessibilityLabel={character.name}
              accessibilityRole="button"
              key={character.slug}
              onPress={() => {
                track("home_card_opened");
                goToVoices(character.slug);
              }}
              style={({ pressed }) => [styles.person, pressed && styles.pressed]}
              testID={`home-character-${character.slug}`}
            >
              <LinearGradient colors={[character.gradientFrom, character.gradientTo]} style={styles.avatar}>
                <Text style={[styles.initial, { color: color.avatarInitial }]}>{character.name[0]}</Text>
              </LinearGradient>
              <Text numberOfLines={1} style={[styles.name, { color: color.inkMuted }]}>
                {character.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  row: { flexDirection: "row", justifyContent: "space-between" },
  person: { alignItems: "center", flex: 1, gap: tokens.space.xs },
  avatar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.cardAvatar,
    justifyContent: "center",
    width: tokens.size.cardAvatar,
  },
  initial: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  name: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
