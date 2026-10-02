import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { Icon, type IconName } from "./Icon";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type AppButtonProps = PropsWithChildren<{
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet";
  /** Ícono `sm` a la izquierda de la etiqueta, del mismo color. */
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function AppButton({ children, disabled = false, icon, onPress, style, testID, variant = "primary" }: AppButtonProps) {
  const { color } = useTheme();
  const labelColor = variant === "primary" ? color.surface : color.ink;

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
        icon && styles.withIcon,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      {icon ? <Icon color={labelColor} name={icon} size="sm" /> : null}
      <Text style={[styles.label, { color: labelColor }]}>
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
  withIcon: { flexDirection: "row", gap: tokens.space.sm },
  pressed: { opacity: tokens.opacity.pressed },
  disabled: { opacity: tokens.opacity.pressed },
  label: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
});
