import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import type { PassageQuery } from "../reading/bookSearch";
import { emptyStateGroups } from "./suggestions";

type QaEmptyStateProps = {
  passage: PassageQuery | null;
  disabled?: boolean;
  onAsk: (question: string) => void;
};

/**
 * Estado vacío de Preguntar (design/oleada-ux.md §U6): "¿Qué querés entender
 * hoy?" + grupos con `overline` `accent` y preguntas tocables en serif
 * `versePicker` con chevron. Con pasaje, un solo grupo "Sobre {pasaje}".
 * Con temporada, sus preguntas de ejemplo encabezan la lista (#199).
 */
export function QaEmptyState({ disabled = false, onAsk, passage }: QaEmptyStateProps) {
  const { color, season } = useTheme();

  return (
    <View style={styles.root} testID="qa-empty">
      <View style={styles.intro}>
        <Text style={[styles.title, { color: color.ink }]}>¿Qué querés entender hoy?</Text>
        <Text style={[styles.lead, { color: color.inkSoft }]}>
          Preguntá con tus palabras. Cada respuesta sale del texto y cita el versículo.
        </Text>
      </View>
      {emptyStateGroups(passage, season).map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={[styles.overline, { color: color.accent }]}>{group.label}</Text>
          <View style={[styles.list, { borderTopColor: color.border }]}>
            {group.questions.map((question) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                key={question}
                onPress={() => onAsk(question)}
                style={({ pressed }) => [styles.row, { borderBottomColor: color.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.question, { color: color.ink }]}>{question}</Text>
                <Icon color={color.inkFaint} name="chevronRight" size="sm" />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.space.xxl, paddingTop: tokens.space.md },
  intro: { gap: tokens.space.xs },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  lead: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  group: { gap: tokens.space.sm },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  list: { borderTopWidth: 1 },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  question: {
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
