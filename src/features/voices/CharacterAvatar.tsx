import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

type CharacterAvatarProps = {
  character: { name: string; gradientFrom: string; gradientTo: string };
  size: number;
  /**
   * Anillo `accent` del personaje del mes (#200). Con `false` el anillo ocupa
   * el mismo lugar, transparente, para que una fila de avatares quede pareja.
   */
  ring?: boolean;
};

/** Avatar de Voces: el degradado del prototipo + la inicial en serif. */
export function CharacterAvatar({ character, ring, size }: CharacterAvatarProps) {
  const { color } = useTheme();
  const avatar = (
    <LinearGradient
      colors={[character.gradientFrom, character.gradientTo]}
      style={[styles.avatar, { height: size, width: size }]}
    >
      <Text style={[styles.initial, { color: color.avatarInitial }]}>{character.name[0]}</Text>
    </LinearGradient>
  );
  if (ring === undefined) return avatar;
  return <View style={[styles.ring, { borderColor: ring ? color.accent : "transparent" }]}>{avatar}</View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: tokens.radius.pill, justifyContent: "center" },
  initial: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  ring: { borderRadius: tokens.radius.pill, borderWidth: tokens.size.ring, padding: tokens.space.xxs },
});
