import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../theme";

type ChipProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Chip({ label, onPress, selected = false, style, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && styles.pressed, style]}
      testID={testID}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.component.chip.radius,
    borderWidth: tokens.component.chip.borderWidth,
    paddingHorizontal: tokens.component.chip.paddingHorizontal,
    paddingVertical: tokens.component.chip.paddingVertical
  },
  selected: { backgroundColor: tokens.color.surfaceSunk, borderColor: tokens.color.accentDeep },
  pressed: { opacity: tokens.component.chip.pressedOpacity },
  label: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.type.bodySm.fontFamily,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight
  },
  selectedLabel: { color: tokens.color.ink }
});
