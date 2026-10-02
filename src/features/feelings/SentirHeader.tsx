import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

type SentirHeaderProps = {
  onOpenDrawer: () => void;
  onClose: () => void;
};

/**
 * Header de Sentir tipo chat (design/oleada-ux.md §U5): ☰ a la izquierda abre
 * el cajón, título al centro, volver al inicio a la derecha.
 */
export function SentirHeader({ onClose, onOpenDrawer }: SentirHeaderProps) {
  const { color } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: color.surface, borderBottomColor: color.border }]}>
      <HeaderButton
        hint="Abre tus devocionales anteriores y el botón para empezar uno nuevo."
        icon="menu"
        label="Tus devocionales"
        onPress={onOpenDrawer}
        testID="sentir-history-open"
      />
      <Text style={[styles.title, { color: color.ink }]}>Sentir</Text>
      <HeaderButton icon="close" label="Volver al inicio" onPress={onClose} testID="sentir-back" />
    </View>
  );
}

function HeaderButton({
  hint,
  icon,
  label,
  onPress,
  testID,
}: {
  hint?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      // Mismo círculo y mismo hitSlop que el ‹ de `ScreenHeader`.
      hitSlop={tokens.space.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { borderColor: color.border }, pressed && styles.pressed]}
      testID={testID}
    >
      <Icon color={color.ink} name={icon} size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  button: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
