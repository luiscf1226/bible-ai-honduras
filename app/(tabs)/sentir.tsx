import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme/tokens";

const feelings = [
  "Ansiedad",
  "Duelo",
  "Gratitud",
  "Decisión difícil",
  "Cansancio",
  "Miedo",
  "Soledad",
  "Necesito perdonar",
  "Deudas",
  "Enojo",
  "Mi familia",
  "Enfermedad",
  "Sin trabajo",
  "Lejos de casa"
] as const;

export default function SentirScreen() {
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  const toggleFeeling = (feeling: string) => {
    setSelectedFeelings((current) =>
      current.includes(feeling) ? current.filter((selected) => selected !== feeling) : [...current, feeling]
    );
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <Pressable
        accessibilityLabel="Volver al inicio"
        accessibilityRole="button"
        onPress={() => router.replace("/home")}
        style={styles.backButton}
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <View>
        <Text style={styles.title}>¿Qué llevas encima hoy?</Text>
        <Text style={styles.description}>
          Escoge lo que más se parezca, o escríbelo con tus palabras. Esto queda solo entre tú y la app.
        </Text>
      </View>

      <View accessibilityLabel="Selecciona uno o más sentimientos" style={styles.chips}>
        {feelings.map((feeling) => {
          const isSelected = selectedFeelings.includes(feeling);

          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={feeling}
              onPress={() => toggleFeeling(feeling)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>{feeling}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        accessibilityLabel="Cuéntanos cómo estuvo tu día"
        multiline
        onChangeText={setFreeText}
        placeholder="Cuéntame en una o dos líneas cómo estuvo tu día. Opcional."
        placeholderTextColor={tokens.color.inkFaint}
        style={styles.input}
        textAlignVertical="top"
        value={freeText}
      />

      <Text style={styles.disclaimer}>Acompañamiento, no consejo pastoral ni atención en crisis.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: tokens.space.xl },
  backButton: {
    alignItems: "center",
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.logoSmall,
    justifyContent: "center",
    width: tokens.size.logoSmall
  },
  backIcon: {
    color: tokens.color.ink,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight
  },
  title: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight
  },
  description: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.sm
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chip: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderStrong,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md
  },
  chipSelected: { backgroundColor: tokens.color.ink, borderColor: tokens.color.ink },
  chipLabel: {
    color: tokens.color.ink,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight
  },
  chipLabelSelected: { color: tokens.color.surface },
  input: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    color: tokens.color.ink,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    minHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl
  },
  disclaimer: {
    color: tokens.color.inkFaint,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center"
  }
});
