import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../theme";

type CardProps = PropsWithChildren<{
  onPress?: () => void;
  padding?: "default" | "module" | "none";
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: "default" | "subtle" | "sunk";
}>;

export function Card({ children, onPress, padding = "default", style, testID, variant = "default" }: CardProps) {
  const paddingStyle = padding === "default"
    ? styles.defaultPadding
    : padding === "module"
      ? styles.modulePadding
      : styles.none;
  const cardStyle = [styles.base, styles[variant], paddingStyle, style];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        testID={testID}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle} testID={testID}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.component.card.radius,
    borderWidth: tokens.component.card.borderWidth
  },
  default: { backgroundColor: tokens.color.surface },
  subtle: { backgroundColor: tokens.color.surfaceAlt },
  sunk: { backgroundColor: tokens.color.surfaceSunk },
  defaultPadding: {
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical
  },
  modulePadding: {
    paddingHorizontal: tokens.component.card.paddingHorizontal,
    paddingVertical: tokens.component.card.paddingVertical
  },
  none: {},
  pressed: { opacity: tokens.component.card.pressedOpacity }
});
