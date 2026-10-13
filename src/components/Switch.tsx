import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type SwitchProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * Interruptor de la app (#232, Fase 4): pista `sage` encendida / `border`
 * apagada y perilla `surface`, con las medidas de `size.switch*`. Antes vivía
 * solo dentro de Ajustes.
 */
export function Switch({ accessibilityLabel, disabled = false, onChange, testID, value }: SwitchProps) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.track, { backgroundColor: value ? color.sage : color.border }]}
      testID={testID}
    >
      <View style={[styles.knob, { backgroundColor: color.surface }, value && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: tokens.radius.pill,
    height: tokens.size.switchTrack.height,
    justifyContent: "center",
    padding: tokens.size.switchPadding,
    width: tokens.size.switchTrack.width,
  },
  knob: { borderRadius: tokens.radius.pill, height: tokens.size.switchKnob, width: tokens.size.switchKnob },
  knobOn: { transform: [{ translateX: tokens.size.switchKnobOffset }] },
});
