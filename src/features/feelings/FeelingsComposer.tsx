import type { Ref } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { FEELINGS } from "./feelings";
import { canSend } from "./thread";

// En web el campo multilínea es un <textarea> que arranca en 2 renglones; en
// iOS/Android arranca en uno y crece. `rows` es solo de react-native-web.
const WEB_SINGLE_ROW = Platform.OS === "web" ? ({ rows: 1 } as object) : {};

type FeelingsComposerProps = {
  selected: readonly string[];
  note: string;
  quotaLabel: string | null;
  error: string | null;
  inputRef: Ref<TextInput>;
  onToggle: (feeling: string) => void;
  onChangeNote: (note: string) => void;
  onSend: () => void;
};

/**
 * Composer fijo de Sentir (design/oleada-ux.md §U5): cuota arriba, los
 * sentimientos como chips con scroll horizontal (multi-selección), y el campo
 * con el botón enviar. Se manda con chips, con texto o con ambos.
 */
export function FeelingsComposer({
  error,
  inputRef,
  note,
  onChangeNote,
  onSend,
  onToggle,
  quotaLabel,
  selected,
}: FeelingsComposerProps) {
  const { color } = useTheme();
  const ready = canSend(selected, note);

  return (
    <View style={[styles.composer, { backgroundColor: color.surface, borderTopColor: color.border }]} testID="sentir-composer">
      {quotaLabel ? <Text style={[styles.quota, { color: color.inkSoft }]}>{quotaLabel}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: color.danger }]}>
          {error}
        </Text>
      ) : null}
      <ScrollView
        accessibilityLabel="Elegí uno o más sentimientos"
        contentContainerStyle={styles.chips}
        horizontal
        // Con el teclado abierto, el primer tap tiene que marcar el chip, no
        // solo cerrar el teclado.
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
      >
        {FEELINGS.map((feeling) => {
          const isSelected = selected.includes(feeling);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={feeling}
              onPress={() => onToggle(feeling)}
              style={[
                styles.chip,
                isSelected
                  ? { backgroundColor: color.ink, borderColor: color.ink }
                  : { backgroundColor: color.surface, borderColor: color.borderStrong },
              ]}
            >
              <Text style={[styles.chipLabel, { color: isSelected ? color.surface : color.inkMuted }]}>{feeling}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.inputRow, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
        <TextInput
          {...WEB_SINGLE_ROW}
          accessibilityLabel="Contá con tus palabras cómo te sentís"
          multiline
          onChangeText={onChangeNote}
          placeholder="Contame cómo te sentís…"
          placeholderTextColor={color.inkFaint}
          ref={inputRef}
          style={[styles.input, { color: color.ink }]}
          testID="sentir-free-text"
          textAlignVertical="center"
          value={note}
        />
        <Pressable
          accessibilityLabel="Preparar mi devocional"
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={onSend}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: ready ? color.ink : color.inkFaint },
            pressed && styles.pressed,
          ]}
          testID="generate-feeling-devotional"
        >
          <Icon color={color.surface} name="send" size="sm" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    borderTopWidth: 1,
    gap: tokens.space.sm,
    paddingBottom: tokens.space.md,
    paddingTop: tokens.space.md,
  },
  quota: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  error: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  chipsScroll: { flexGrow: 0 },
  chips: { gap: tokens.space.sm, paddingHorizontal: tokens.screenPadding.horizontal },
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  chipLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.chip.size,
    lineHeight: tokens.type.chip.lineHeight,
  },
  inputRow: {
    alignItems: "flex-end",
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    marginHorizontal: tokens.screenPadding.horizontal,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  input: {
    flex: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    // El campo crece con el texto hasta este tope; después scrollea adentro
    // (mismo tope que tenía el campo libre, issues #105 y #109).
    maxHeight: tokens.size.logoLarge,
    minHeight: tokens.size.sendButton,
    paddingVertical: tokens.space.xs,
  },
  send: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.sendButton,
    justifyContent: "center",
    width: tokens.size.sendButton,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
