import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAction } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { LinearGradient } from "expo-linear-gradient";

import { AppButton } from "../../src/components/AppButton";
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

type FeelingDevotional = {
  citation: { book: string; chapter: number; verse: number; version: string; text: string };
  prayer: string;
  reflection: string;
  title: string;
};

const generateFeelingDevotional = makeFunctionReference<
  "action",
  { feelings: string[]; note?: string },
  FeelingDevotional
>("feelings:generate");

export default function SentirScreen() {
  const generate = useAction(generateFeelingDevotional);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [devotional, setDevotional] = useState<FeelingDevotional | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleFeeling = (feeling: string) => {
    setSelectedFeelings((current) =>
      current.includes(feeling) ? current.filter((selected) => selected !== feeling) : [...current, feeling]
    );
  };

  const canGenerate = selectedFeelings.length > 0 || freeText.trim().length > 0;

  const generateDevotional = async () => {
    if (!canGenerate || isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generate({ feelings: selectedFeelings, note: freeText });
      setDevotional(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos preparar tu devocional. Intentá de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <AppScreen contentStyle={styles.generatingContent} style={styles.generatingScreen}>
        <View style={styles.generatingCard}>
          <Text style={styles.generatingTitle}>Buscando un pasaje que hable de esto…</Text>
          <Text style={styles.generatingDescription}>Tomá un respiro mientras tanto.</Text>
        </View>
      </AppScreen>
    );
  }

  if (devotional) {
    const reference = `${devotional.citation.book} ${devotional.citation.chapter}:${devotional.citation.verse} · ${devotional.citation.version}`;
    return (
      <AppScreen scroll contentStyle={styles.resultContent} style={styles.resultScreen}>
        <Pressable
          accessibilityLabel="Volver a sentimiento"
          accessibilityRole="button"
          onPress={() => setDevotional(null)}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <LinearGradient colors={[tokens.color.surfaceSunk, tokens.color.sage]} style={styles.resultImage} />
        <Text style={styles.resultKicker}>{devotional.title}</Text>
        <Text style={styles.resultTitle}>Un momento con Dios</Text>
        <Text style={styles.quote}>“{devotional.citation.text}”</Text>
        <Text style={styles.reference}>{reference}</Text>
        <Text style={styles.reflection}>{devotional.reflection}</Text>
        <View style={styles.prayerCard}>
          <Text style={styles.prayerKicker}>UNA ORACIÓN CORTA</Text>
          <Text style={styles.prayer}>{devotional.prayer}</Text>
        </View>
        <AppButton onPress={() => void generateDevotional()} variant="secondary">
          Dame otro enfoque
        </AppButton>
        <Text style={styles.privateNote}>Este devocional es privado. No se comparte ni se publica.</Text>
      </AppScreen>
    );
  }

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

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <AppButton disabled={!canGenerate} onPress={() => void generateDevotional()} testID="generate-feeling-devotional">
        Prepárame un devocional
      </AppButton>
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
  },
  error: {
    color: tokens.color.accentDeep,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center"
  },
  generatingScreen: { backgroundColor: tokens.color.bg },
  generatingContent: { flex: 1, justifyContent: "center" },
  generatingCard: { alignItems: "center", gap: tokens.space.lg },
  generatingTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center"
  },
  generatingDescription: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center"
  },
  resultScreen: { backgroundColor: tokens.color.surface },
  resultContent: { gap: tokens.space.lg },
  resultImage: { borderRadius: tokens.radius.xl, height: tokens.size.logoLarge, width: "100%" },
  resultKicker: {
    color: tokens.color.accent,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase"
  },
  resultTitle: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight
  },
  quote: {
    borderLeftColor: tokens.color.borderStrong,
    borderLeftWidth: 1,
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight,
    paddingLeft: tokens.space.lg
  },
  reference: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    paddingLeft: tokens.space.lg
  },
  reflection: {
    color: tokens.color.inkMuted,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight
  },
  prayerCard: {
    backgroundColor: tokens.color.surfaceSunk,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl
  },
  prayerKicker: {
    color: tokens.color.accent,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight
  },
  prayer: {
    color: tokens.color.ink,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight
  },
  privateNote: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center"
  }
});
