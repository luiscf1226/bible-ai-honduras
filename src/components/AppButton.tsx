import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../theme/tokens";

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function AppButton({ children, disabled = false, onPress, style, testID, variant = "primary" }: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled, style]}
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
    borderRadius: tokens.radius.lg,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.lg
  },
  primary: { backgroundColor: tokens.color.ink },
  secondary: { backgroundColor: tokens.color.surface, borderColor: tokens.color.borderStrong, borderWidth: 1 },
  quiet: { backgroundColor: "transparent", paddingVertical: tokens.space.md },
  pressed: { opacity: tokens.type.bodySm.size / tokens.type.label.size },
  disabled: { opacity: 0.6 },
  label: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  labelPrimary: { color: tokens.color.surface },
  labelSecondary: { color: tokens.color.ink }
});
