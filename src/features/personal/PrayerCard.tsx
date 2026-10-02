import { useMutation } from "convex/react";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AppButton } from "../../components/AppButton";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { PRAYER_MAX_LENGTH, prayerDateLabel, type PrayerItem } from "./prayerJournal";

type PrayerCardProps = { item: PrayerItem };

/**
 * Tarjeta de una petición del diario de oración (#159). No está en el
 * prototype: se compone con la tarjeta de un versículo guardado
 * (`SavedVerseCard`: etiqueta, cuerpo, fila de abajo con acciones de texto) y
 * con el campo de la nota personal del lector (#167). Cero tokens nuevos.
 *
 * "Respondida" abre ahí mismo un campo opcional para anotar cómo respondió
 * Dios. No hay "Compartir": las peticiones son privadas.
 */
export function PrayerCard({ item }: PrayerCardProps) {
  const { color } = useTheme();
  const markAnswered = useMutation(api.prayers.markAnswered);
  const reopen = useMutation(api.prayers.reopen);
  const remove = useMutation(api.prayers.remove);
  const [answerDraft, setAnswerDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = item.id as Id<"prayerRequests">;
  const answered = item.answeredAt !== null;
  const reference = item.verse ? `${item.verse.book} ${item.verse.chapter}:${item.verse.verse}` : null;

  const confirmRemove = () => {
    Alert.alert("¿Borrar esta petición?", "Se borra de verdad, con su nota. No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => void remove({ id }).catch(() => undefined) },
    ]);
  };

  const saveAnswer = async () => {
    try {
      await markAnswered({ id, note: answerDraft ?? "" });
      setAnswerDraft(null);
      setError(null);
    } catch {
      setError("No pudimos guardarla. Revisá tu conexión e intentá de nuevo.");
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="prayer-card">
      <Text style={[styles.kind, { color: answered ? color.sage : color.accent }]}>
        {answered ? "RESPONDIDA" : "PETICIÓN"}
      </Text>
      <Text style={[styles.text, { color: color.ink }]}>{item.text}</Text>

      {answered && item.answerNote ? (
        <View style={[styles.note, { backgroundColor: color.surfaceSunk }]} testID="prayer-answer-note">
          <Text style={[styles.noteText, { color: color.inkMuted }]}>{item.answerNote}</Text>
        </View>
      ) : null}

      {answerDraft !== null ? (
        <View style={styles.answerForm} testID="prayer-answer-form">
          <Text style={[styles.label, { color: color.sage }]}>¿CÓMO RESPONDIÓ DIOS? · OPCIONAL</Text>
          <TextInput
            accessibilityLabel="Nota opcional sobre cómo fue respondida"
            autoFocus
            maxLength={PRAYER_MAX_LENGTH}
            multiline
            onChangeText={setAnswerDraft}
            placeholder="Por ejemplo: “Lo llamaron de la entrevista”."
            placeholderTextColor={color.inkFaint}
            style={[styles.input, { backgroundColor: color.surface, borderColor: color.sage, color: color.ink }]}
            testID="prayer-answer-input"
            textAlignVertical="top"
            value={answerDraft}
          />
          {error ? (
            <Text accessibilityRole="alert" style={[styles.meta, { color: color.accentDeep }]}>
              {error}
            </Text>
          ) : null}
          <AppButton onPress={() => void saveAnswer()} testID="prayer-answer-save">
            Marcar respondida
          </AppButton>
          <AppButton onPress={() => setAnswerDraft(null)} variant="quiet">
            Cancelar
          </AppButton>
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: color.border }]}>
        <Text numberOfLines={2} style={[styles.meta, { color: color.inkSoft }]}>
          {prayerDateLabel(item)}
          {reference ? ` · ${reference}` : ""}
        </Text>
        <View style={styles.actions}>
          {answerDraft === null ? (
            answered ? (
              <Pressable
                accessibilityHint="La vuelve a poner entre las abiertas y borra la nota."
                accessibilityRole="button"
                hitSlop={tokens.space.sm}
                onPress={() => void reopen({ id }).catch(() => undefined)}
                testID="prayer-reopen"
              >
                <Text style={[styles.action, { color: color.inkSoft }]}>Reabrir</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                hitSlop={tokens.space.sm}
                onPress={() => setAnswerDraft("")}
                testID="prayer-mark-answered"
              >
                <Text style={[styles.action, { color: color.sage }]}>Respondida</Text>
              </Pressable>
            )
          ) : null}
          <Pressable
            accessibilityLabel="Borrar esta petición"
            accessibilityRole="button"
            hitSlop={tokens.space.sm}
            onPress={confirmRemove}
            testID="prayer-remove"
          >
            <Text style={[styles.action, { color: color.inkSoft }]}>Borrar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, padding: tokens.space.xl },
  kind: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  // Lo escribió la persona, no es un versículo: DM Sans, no serif.
  text: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.md,
  },
  note: { borderRadius: tokens.radius.md, marginTop: tokens.space.md, padding: tokens.space.md },
  noteText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  answerForm: { gap: tokens.space.sm, marginTop: tokens.space.lg },
  label: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  input: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    maxHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    justifyContent: "space-between",
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  meta: { flexShrink: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  actions: { flexDirection: "row", gap: tokens.space.lg },
  action: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
});
