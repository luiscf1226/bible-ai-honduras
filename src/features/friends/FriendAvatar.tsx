import { StyleSheet, Text, View } from "react-native";

import { unreadLabel } from "../../../convex/friendsCore";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

/**
 * Inicial de la persona en un círculo `accent` (no hay fotos de perfil entre
 * amigos). Mismo tratamiento que el avatar de los personajes de Voces.
 */
export function FriendAvatar({ initial, size = "card" }: { initial: string; size?: "card" | "header" }) {
  const { color } = useTheme();
  const side = size === "card" ? tokens.size.cardAvatar : tokens.size.logoSmall;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: color.accent, height: side, width: side }]}
    >
      <Text style={[styles.initial, { color: color.avatarInitial }]}>{initial}</Text>
    </View>
  );
}

/** Contador de no leídos: círculo `accent` con el número en `surface`. */
export function UnreadBadge({ count, testID }: { count: number; testID?: string }) {
  const { color } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      accessibilityLabel={count === 1 ? "1 mensaje sin leer" : `${unreadLabel(count)} mensajes sin leer`}
      style={[styles.badge, { backgroundColor: color.accent }]}
      testID={testID}
    >
      <Text style={[styles.badgeText, { color: color.surface }]}>{unreadLabel(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", borderRadius: tokens.radius.pill, justifyContent: "center" },
  initial: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  badge: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.badge,
    justifyContent: "center",
    minWidth: tokens.size.badge,
    paddingHorizontal: tokens.space.xs,
  },
  badgeText: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
