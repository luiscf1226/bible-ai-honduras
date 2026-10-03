import { useQuery } from "convex/react";
import { StyleSheet, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { tokens } from "../../../theme/tokens";
import { CharacterAvatar } from "../../voices/CharacterAvatar";
import { useFeaturedCharacter } from "../../voices/useFeaturedCharacter";
import { HOME_ROUTES, pickHomeCharacters } from "../homeCards";
import { HomeTile, openFromHome } from "./HomeCard";

/**
 * Mosaico Personajes (U1b): 4 avatares encimados del catálogo de Voces, con
 * el mismo degradado + inicial de `voces.tsx`. El mosaico abre el catálogo.
 *
 * El personaje del mes (#200) va primero, con anillo `accent`, y el mosaico
 * lleva `DEL MES` arriba a la derecha. Los demás llevan el anillo
 * transparente para que la fila quede pareja.
 */
export function CharactersCard() {
  const characters = useQuery(api.voices.list);
  const featured = useFeaturedCharacter();
  const shown = pickHomeCharacters(characters ?? [], featured?.slug);
  const names = shown.map((character) => character.name).join(", ");

  return (
    <HomeTile
      accessibilityHint={names ? `Abre la lista de personajes: ${names}.` : "Abre la lista de personajes."}
      badge={featured ? "Del mes" : undefined}
      icon="voice"
      onPress={() => openFromHome(HOME_ROUTES.characters)}
      testID="home-card-characters"
      title="Personajes"
    >
      {shown.length > 0 ? (
        <View style={styles.row}>
          {shown.map((character, index) => (
            <View
              key={character.slug}
              style={[styles.avatar, index > 0 && styles.overlap, { zIndex: shown.length - index }]}
              testID={`home-character-${character.slug}`}
            >
              <CharacterAvatar character={character} ring={character.slug === featured?.slug} size={tokens.size.tileAvatar} />
            </View>
          ))}
        </View>
      ) : null}
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  avatar: { borderRadius: tokens.radius.pill },
  overlap: { marginLeft: -tokens.space.sm },
});
