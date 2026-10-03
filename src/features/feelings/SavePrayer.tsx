import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppButton } from "../../components/AppButton";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { PRAYER_MAX_LENGTH } from "../personal/prayerJournal";

type SavePrayerProps = {
  /** Texto inicial del campo (`prayerDraft`). */
  draft: string;
  verse: { book: string; chapter: number; verse: number };
  onCancel: () => void;
};

/**
 * "Guardar como petición" (#159) dentro del devocional del hilo de Sentir.
 * Mismo campo que la nota del lector (#167): privado, no va a la IA.
 */
export function SavePrayer({ draft, onCancel, verse }: SavePrayerProps) {
  const { color } = useTheme();
  const createPrayer = useMutation(api.prayers.create);
  const [text, setText] = useState(draft);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!text.trim()) return;
    try {
      await createPrayer({ text, verse });
      setSaved(true);
      setError(null);
    } catch {
      setError("No pudimos guardar tu petición. Revisá tu conexión e intentá de nuevo.");
    }
  };

  if (saved) {
    return (
      <View style={styles.saved} testID="sentir-prayer-saved">
        <Text style={[styles.caption, { color: color.sage }]}>Quedó en tu diario de oración.</Text>
        <AppButton onPress={() => router.push("/oracion")} testID="sentir-prayer-open" variant="quiet">
          Ver mi diario de oración
        </AppButton>
      </View>
    );
  }

  return (
    <View style={styles.form} testID="sentir-prayer-form">
      <Text style={[styles.label, { color: color.accent }]}>TU PETICIÓN · PRIVADA</Text>
      <TextInput
        accessibilityLabel="Escribí tu petición de oración"
        autoFocus
        maxLength={PRAYER_MAX_LENGTH}
        multiline
        onChangeText={setText}
        placeholder="Por ejemplo: “Que encuentre trabajo pronto”."
        placeholderTextColor={color.inkFaint}
        style={[styles.input, { backgroundColor: color.surface, borderColor: color.accent, color: color.ink }]}
        testID="sentir-prayer-input"
        textAlignVertical="top"
        value={text}
      />
      <Text style={[styles.caption, { color: color.inkFaint }]}>
        {text.length}/{PRAYER_MAX_LENGTH} · No se comparte ni se envía a la IA.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.caption, { color: color.accentDeep }]}>
          {error}
        </Text>
      ) : null}
      <AppButton disabled={!text.trim()} onPress={() => void save()} testID="sentir-prayer-save">
        Guardar petición
      </AppButton>
      <AppButton onPress={onCancel} variant="quiet">
        Cancelar
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.space.sm },
  saved: { alignItems: "center" },
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
    // Crece con el texto hasta el tope y después scrollea adentro (#105, #109).
    maxHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  caption: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
});
