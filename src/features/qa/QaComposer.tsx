import type { RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "../../components/Icon";
import { LimitReached } from "../../components/LimitReached";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import type { PassageQuery } from "../reading/bookSearch";
import { PassageChip } from "./PassageChip";

type QaComposerProps = {
  draft: string;
  onChangeDraft: (text: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  atLimit: boolean;
  suggestions: readonly string[];
  passage: PassageQuery | null;
  onOpenPassage: () => void;
  onClearPassage: () => void;
  inputRef: RefObject<TextInput | null>;
  autoFocus?: boolean;
};

/**
 * Composer fijo de Preguntar: sugerencias según el contexto, chip de pasaje
 * encima del campo y el campo pill con enviar. Al llegar al límite se
 * reemplaza entero por `LimitReached variant="inline"` y el hilo sigue a la
 * vista (regla dura #3: el mismo componente de límite que el resto).
 */
export function QaComposer({
  atLimit,
  autoFocus,
  busy,
  draft,
  inputRef,
  onChangeDraft,
  onClearPassage,
  onOpenPassage,
  onSend,
  passage,
  suggestions,
}: QaComposerProps) {
  const { color } = useTheme();

  if (atLimit) {
    return (
      <View style={[styles.composer, { backgroundColor: color.surface, borderTopColor: color.border }]}>
        <LimitReached module="qa" testID="qa-limit" variant="inline" />
      </View>
    );
  }

  const canSend = draft.trim().length > 0 && !busy;

  return (
    <View style={[styles.composer, { backgroundColor: color.surface, borderTopColor: color.border }]}>
      {suggestions.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.suggestions}
          horizontal
          // Chips tocables al lado del input: sin esto el primer tap con el
          // teclado abierto solo lo cierra y se traga la sugerencia.
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {suggestions.map((suggestion) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              key={suggestion}
              onPress={() => onSend(suggestion)}
              style={({ pressed }) => [
                styles.suggestion,
                { backgroundColor: color.surface, borderColor: color.borderStrong },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.suggestionLabel, { color: color.inkSoft }]}>{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <PassageChip onClear={onClearPassage} onOpen={onOpenPassage} passage={passage} />
      <View style={[styles.inputRow, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
        <TextInput
          accessibilityLabel="Tu pregunta"
          autoFocus={autoFocus}
          onChangeText={onChangeDraft}
          onSubmitEditing={() => onSend(draft)}
          placeholder="Escribí tu pregunta…"
          placeholderTextColor={color.inkFaint}
          ref={inputRef}
          returnKeyType="send"
          style={[styles.input, { color: color.ink }]}
          testID="qa-input"
          value={draft}
        />
        <Pressable
          accessibilityLabel="Enviar pregunta"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => onSend(draft)}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: canSend ? color.ink : color.borderStrong },
            pressed && styles.pressed,
          ]}
          testID="qa-send"
        >
          <Icon color={canSend ? color.surface : color.inkSoft} name="send" size="sm" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    borderTopWidth: 1,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  suggestions: { gap: tokens.space.sm },
  suggestion: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  suggestionLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.chip.size },
  inputRow: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  input: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  send: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.sendButton,
    justifyContent: "center",
    width: tokens.size.sendButton,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
