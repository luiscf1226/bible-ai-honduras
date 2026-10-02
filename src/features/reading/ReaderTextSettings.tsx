import { Pressable, StyleSheet, Text, View } from "react-native";

import { BottomPanel } from "../../components/BottomPanel";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import {
  READING_FONT_LABELS,
  READING_FONT_SCALES,
  READING_LINE_SPACINGS,
  READING_SPACING_LABELS,
} from "./readingSettings";

type ReaderTextSettingsProps = {
  fontStep: number;
  spacingStep: number;
  onFontStep: (direction: 1 | -1) => void;
  onSpacingStep: (direction: 1 | -1) => void;
  onClose: () => void;
};

/**
 * Hoja "Aa" del lector (#195, U3): tamaño de letra e interlineado. La lógica
 * es la misma de #113 (`readingSettings.ts` + `users.updatePreferences`); solo
 * salió de la página a una hoja.
 */
export function ReaderTextSettings({ fontStep, onClose, onFontStep, onSpacingStep, spacingStep }: ReaderTextSettingsProps) {
  const { color } = useTheme();
  const rows = [
    {
      label: "Tamaño",
      value: READING_FONT_LABELS[fontStep],
      step: onFontStep,
      atMin: fontStep === 0,
      atMax: fontStep === READING_FONT_SCALES.length - 1,
      minus: { text: "A−", label: "Reducir tamaño de letra" },
      plus: { text: "A+", label: "Aumentar tamaño de letra" },
    },
    {
      label: "Espaciado",
      value: READING_SPACING_LABELS[spacingStep],
      step: onSpacingStep,
      atMin: spacingStep === 0,
      atMax: spacingStep === READING_LINE_SPACINGS.length - 1,
      minus: { text: "−", label: "Reducir interlineado" },
      plus: { text: "+", label: "Aumentar interlineado" },
    },
  ];

  return (
    <BottomPanel
      header={
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: color.ink }]}>Letra</Text>
          <Pressable
            accessibilityLabel="Cerrar"
            accessibilityRole="button"
            hitSlop={tokens.space.md}
            onPress={onClose}
            testID="reading-text-settings-close"
          >
            <Icon color={color.inkSoft} name="close" />
          </Pressable>
        </View>
      }
      testID="reading-text-settings-panel"
    >
      {rows.map((row) => (
        <View key={row.label} style={[styles.row, { borderBottomColor: color.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.overline, { color: color.inkSoft }]}>{row.label.toUpperCase()}</Text>
            <Text style={[styles.value, { color: color.ink }]}>{row.value}</Text>
          </View>
          {[
            { ...row.minus, direction: -1 as const, disabled: row.atMin },
            { ...row.plus, direction: 1 as const, disabled: row.atMax },
          ].map((button) => (
            <Pressable
              accessibilityLabel={button.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: button.disabled }}
              key={button.label}
              onPress={() => row.step(button.direction)}
              style={[styles.stepper, { borderColor: color.border }, button.disabled && styles.disabled]}
            >
              <Text style={[styles.stepperText, { color: color.ink }]}>{button.text}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </BottomPanel>
  );
}

const styles = StyleSheet.create({
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  rowText: { flex: 1, gap: tokens.space.xxs },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  value: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  stepper: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  stepperText: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size },
  disabled: { opacity: tokens.opacity.pressed },
});
