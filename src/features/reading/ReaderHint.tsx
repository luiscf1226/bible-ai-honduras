import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

/** Pista de primera vez del lector (#196, U4). Ver `readerHint.ts`. */
export function ReaderHint({ onDismiss }: { onDismiss: () => void }) {
  const { color } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.hint, { backgroundColor: color.surfaceSunk }]}
      testID="reading-hint"
    >
      <Icon color={color.accent} name="highlight" />
      <Text style={[styles.text, { color: color.inkMuted }]}>
        Tocá un versículo para subrayar, guardar, anotar o poner tu separador.
      </Text>
      <Pressable
        accessibilityLabel="Cerrar la pista"
        accessibilityRole="button"
        hitSlop={tokens.space.md}
        onPress={onDismiss}
        testID="reading-hint-close"
      >
        <Icon color={color.inkSoft} name="close" size="sm" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  text: {
    flex: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
});
