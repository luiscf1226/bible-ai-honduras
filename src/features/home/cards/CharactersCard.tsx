import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { goToVoices } from "../../../lib/goToVoices";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { CharacterAvatar } from "../../voices/CharacterAvatar";
import { openFeaturedShortcut, useFeaturedCharacter } from "../../voices/useFeaturedCharacter";
import { CHARACTERS_CARD_CAPTION, HOME_ROUTES, pickHomeCharacters } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Tarjeta 5, Personajes de la Biblia (U1): 4 avatares del catálogo de Voces,
 * con el mismo degradado + inicial de `voces.tsx`. Tocar un avatar abre esa
 * conversación; la tarjeta, el catálogo. Voces no cambia por dentro.
 *
 * El personaje del mes (#200) va primero, con anillo `accent` y `DEL MES`
 * encima. Los demás llevan el mismo lugar vacío para que la fila quede pareja.
 */
export function CharactersCard() {
  const { color } = useTheme();
  const characters = useQuery(api.voices.list);
  const featured = useFeaturedCharacter();
  const shown = pickHomeCharacters(characters ?? [], featured?.slug);

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
          {shown.map((character) => {
            const isFeatured = character.slug === featured?.slug;
            return (
              <Pressable
                accessibilityHint={`Abre la conversación con ${character.name}.`}
                accessibilityLabel={isFeatured ? `${character.name}, personaje del mes` : character.name}
                accessibilityRole="button"
                key={character.slug}
                onPress={() => {
                  if (featured && isFeatured) {
                    openFeaturedShortcut("conversar", featured);
                    return;
                  }
                  track("home_card_opened");
                  goToVoices(character.slug);
                }}
                style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                testID={`home-character-${character.slug}`}
              >
                {featured ? (
                  <Text style={[styles.overline, { color: color.accent }]}>{isFeatured ? "Del mes" : " "}</Text>
                ) : null}
                <CharacterAvatar character={character} ring={featured ? isFeatured : undefined} size={tokens.size.cardAvatar} />
                <Text numberOfLines={1} style={[styles.name, { color: color.inkMuted }]}>
                  {character.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  row: { flexDirection: "row", justifyContent: "space-between" },
  person: { alignItems: "center", flex: 1, gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  name: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
