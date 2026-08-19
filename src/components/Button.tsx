import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../theme";

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function Button({ children, onPress, style, testID, variant = "primary" }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, style]}
      testID={testID}
    >
      <Text style={[styles.label, variant === "primary" ? styles.labelPrimary : styles.labelSecondary]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: tokens.component.button.radius,
    justifyContent: "center",
    paddingHorizontal: tokens.component.button.paddingHorizontal,
    paddingVertical: tokens.component.button.paddingVertical
  },
  primary: { backgroundColor: tokens.color.ink },
  secondary: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderWidth: tokens.component.button.borderWidth
  },
  quiet: {
    backgroundColor: "transparent",
    paddingVertical: tokens.component.button.quietPaddingVertical
  },
  pressed: { opacity: tokens.component.button.pressedOpacity },
  label: {
    fontFamily: tokens.type.label.fontFamily,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight
  },
  labelPrimary: { color: tokens.color.surface },
  labelSecondary: { color: tokens.color.ink }
});
