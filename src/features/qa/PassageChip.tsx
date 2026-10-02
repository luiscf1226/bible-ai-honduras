import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import type { PassageQuery } from "../reading/bookSearch";
import { passageChipLabel } from "./suggestions";

type PassageChipProps = {
  passage: PassageQuery | null;
  onOpen: () => void;
  onClear: () => void;
};

/**
 * Chip de contexto encima del campo (design/oleada-ux.md §U6): pill con borde
 * `borderStrong`, ícono `book` y "Elegir pasaje (opcional)" o "Juan 3" + ✕.
 * El pasaje es opcional: se pregunta primero y se elige después.
 */
export function PassageChip({ onClear, onOpen, passage }: PassageChipProps) {
  const { color } = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
      <Pressable
        accessibilityHint="Abre el buscador de pasajes."
        accessibilityLabel={passage ? `Pasaje: ${passageChipLabel(passage)}. Cambiar` : "Elegir pasaje, opcional"}
        accessibilityRole="button"
        hitSlop={tokens.space.xs}
        onPress={onOpen}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        testID="qa-passage-chip"
      >
        <Icon color={passage ? color.accent : color.inkSoft} name="book" size="sm" />
        <Text style={[styles.label, { color: passage ? color.ink : color.inkSoft }]}>{passageChipLabel(passage)}</Text>
      </Pressable>
      {passage ? (
        <Pressable
          accessibilityLabel={`Quitar ${passageChipLabel(passage)}`}
          accessibilityRole="button"
          hitSlop={tokens.space.sm}
          onPress={onClear}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          testID="qa-passage-clear"
        >
          <Icon color={color.inkSoft} name="close" size="sm" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  open: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  clear: { marginLeft: tokens.space.xxs },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.chip.size, lineHeight: tokens.type.caption.lineHeight },
  pressed: { opacity: tokens.opacity.pressed },
});
