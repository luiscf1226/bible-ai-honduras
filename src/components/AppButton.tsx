import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function AppButton({ children, disabled = false, onPress, style, testID, variant = "primary" }: AppButtonProps) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && { backgroundColor: color.ink },
        variant === "secondary" && { backgroundColor: color.surface, borderColor: color.borderStrong, borderWidth: 1 },
        variant === "quiet" && styles.quiet,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? { color: color.surface } : { color: color.ink },
        ]}
      >
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
    paddingVertical: tokens.space.lg,
  },
  quiet: { backgroundColor: "transparent", paddingVertical: tokens.space.md },
  pressed: { opacity: tokens.opacity.pressed },
  disabled: { opacity: tokens.opacity.pressed },
  label: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
});
