import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { LinearGradient } from "expo-linear-gradient";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { LimitReached } from "../../src/components/LimitReached";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../../src/theme/ThemeProvider";
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
  "Lejos de casa",
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
  | { allowed: true; conversationId: string; devotional: FeelingDevotional }
  | { allowed: false; reason: "limit_reached"; module: "feelings" }
>("feelings:generate");

const getHistoryConversation = makeFunctionReference<
  "query",
  { conversationId: string },
  | {
      module: "qa" | "voices" | "feelings";
      messages: Array<{ role: "user" | "assistant"; text: string; devotional?: FeelingDevotional }>;
    }
  | null
>("history:getById");

export default function SentirScreen() {
  const { color } = useTheme();
  const generate = useAction(generateFeelingDevotional);
  const pastDevotionals = useQuery(api.history.list, {})?.filter((item) => item.module === "feelings") ?? [];
  const quota = useQuery(api.quotas.remaining, { module: "feelings" });
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [devotional, setDevotional] = useState<FeelingDevotional | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const historicalConversation = useQuery(
    getHistoryConversation,
    selectedHistoryId ? { conversationId: selectedHistoryId } : "skip",
  );
  const historicalDevotional =
    historicalConversation?.messages.find((message) => message.devotional)?.devotional ?? null;
  const activeDevotional = devotional ?? historicalDevotional;

  const toggleFeeling = (feeling: string) => {
    setSelectedFeelings((current) =>
      current.includes(feeling) ? current.filter((selected) => selected !== feeling) : [...current, feeling],
    );
  };

  const canGenerate = selectedFeelings.length > 0 || freeText.trim().length > 0;

  const generateDevotional = async () => {
    if (!canGenerate || isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generate({ feelings: selectedFeelings, note: freeText });
      if (!result.allowed) {
        setLimitReached(true);
        return;
      }
      setDevotional(result.devotional);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos preparar tu devocional. Intentá de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);
  if (atLimit && !activeDevotional) {
    return <LimitReached module="feelings" testID="feelings-limit" />;
  }

  if (isGenerating) {
    return (
      <AppScreen contentStyle={styles.generatingContent} style={{ backgroundColor: color.bg }}>
        <View style={styles.generatingCard}>
          <Text style={[styles.generatingTitle, { color: color.ink }]}>Buscando un pasaje que hable de esto…</Text>
          <Text style={[styles.generatingDescription, { color: color.inkSoft }]}>Tomá un respiro mientras tanto.</Text>
        </View>
      </AppScreen>
    );
  }

  if (selectedHistoryId && historicalConversation === undefined) {
    return (
      <AppScreen contentStyle={styles.generatingContent} style={{ backgroundColor: color.bg }}>
        <Text style={[styles.generatingTitle, { color: color.ink }]}>Abriendo tu devocional…</Text>
      </AppScreen>
    );
  }

  if (activeDevotional) {
    const reference = `${activeDevotional.citation.book} ${activeDevotional.citation.chapter}:${activeDevotional.citation.verse} · ${activeDevotional.citation.version}`;
    return (
      <AppScreen scroll contentStyle={styles.resultContent}>
        <Pressable
          accessibilityLabel="Volver a sentimiento"
          accessibilityRole="button"
          onPress={() => {
            setDevotional(null);
            setSelectedHistoryId(null);
          }}
          style={[styles.backButton, { borderColor: color.border }]}
        >
          <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
        </Pressable>
        <LinearGradient colors={[color.surfaceSunk, color.sage]} style={styles.resultImage} />
        <Text style={[styles.resultKicker, { color: color.accent }]}>{activeDevotional.title}</Text>
        <Text style={[styles.resultTitle, { color: color.ink }]}>Un momento con Dios</Text>
        <Text style={[styles.quote, { borderLeftColor: color.borderStrong, color: color.inkMuted }]}>
          “{activeDevotional.citation.text}”
        </Text>
        <Text style={[styles.reference, { color: color.inkSoft }]}>{reference}</Text>
        <Text style={[styles.reflection, { color: color.inkMuted }]}>{activeDevotional.reflection}</Text>
        <View style={[styles.prayerCard, { backgroundColor: color.surfaceSunk, borderColor: color.border }]}>
          <Text style={[styles.prayerKicker, { color: color.accent }]}>UNA ORACIÓN CORTA</Text>
          <Text style={[styles.prayer, { color: color.ink }]}>{activeDevotional.prayer}</Text>
        </View>
        <AppButton onPress={() => void generateDevotional()} variant="secondary">
          Dame otro enfoque
        </AppButton>
        <Text style={[styles.privateNote, { color: color.inkSoft }]}>
          Este devocional es privado. No se comparte ni se publica.
        </Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <Pressable
        accessibilityLabel="Volver al inicio"
        accessibilityRole="button"
        onPress={() => router.replace("/home")}
        style={[styles.backButton, { borderColor: color.border }]}
      >
        <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
      </Pressable>

      <View>
        <Text style={[styles.quota, { color: color.inkSoft }]}>
          {quota?.isPro
            ? "Pro · sin límite"
            : `${quota?.remaining ?? "…"} de ${quota?.limit ?? "…"} devocionales gratis hoy`}
        </Text>
        <Text style={[styles.title, { color: color.ink }]}>¿Qué llevas encima hoy?</Text>
        <Text style={[styles.description, { color: color.inkMuted }]}>
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
              style={[
                styles.chip,
                { backgroundColor: color.surface, borderColor: color.borderStrong },
                isSelected && { backgroundColor: color.ink, borderColor: color.ink },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: color.ink },
                  isSelected && { color: color.surface },
                ]}
              >
                {feeling}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        accessibilityLabel="Cuéntanos cómo estuvo tu día"
        multiline
        onChangeText={setFreeText}
        placeholder="Cuéntame en una o dos líneas cómo estuvo tu día. Opcional."
        placeholderTextColor={color.inkFaint}
        style={[
          styles.input,
          { backgroundColor: color.surface, borderColor: color.border, color: color.ink },
        ]}
        textAlignVertical="top"
        value={freeText}
      />

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: color.accentDeep }]}>
          {error}
        </Text>
      ) : null}
      <AppButton disabled={!canGenerate} onPress={() => void generateDevotional()} testID="generate-feeling-devotional">
        Prepárame un devocional
      </AppButton>
      <Text style={[styles.disclaimer, { color: color.inkFaint }]}>
        Acompañamiento, no consejo pastoral ni atención en crisis.
      </Text>

      {pastDevotionals.length > 0 ? (
        <View style={styles.historySection}>
          <Text style={[styles.historyKicker, { color: color.inkSoft }]}>LOS DE ANTES</Text>
          {pastDevotionals.map((item) => (
            <Pressable
              accessibilityHint="Abre este devocional anterior."
              accessibilityRole="button"
              key={item.id}
              onPress={() => setSelectedHistoryId(item.id)}
              style={[styles.historyItem, { backgroundColor: color.surface, borderColor: color.border }]}
            >
              <View style={[styles.historyDot, { backgroundColor: color.sage }]} />
              <View style={styles.historyCopy}>
                <Text numberOfLines={1} style={[styles.historyTitle, { color: color.ink }]}>
                  {item.preview}
                </Text>
                <Text style={[styles.historyMeta, { color: color.inkSoft }]}>{item.title}</Text>
              </View>
              <Text style={[styles.historyArrow, { color: color.borderStrong }]}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl },
  backButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.logoSmall,
    justifyContent: "center",
    width: tokens.size.logoSmall,
  },
  backIcon: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight,
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
  },
  description: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.sm,
  },
  quota: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginBottom: tokens.space.md,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  chipLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  input: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    minHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl,
  },
  disclaimer: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  error: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
  generatingContent: { flex: 1, justifyContent: "center" },
  generatingCard: { alignItems: "center", gap: tokens.space.lg },
  generatingTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center",
  },
  generatingDescription: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
  resultContent: { gap: tokens.space.lg },
  resultImage: { borderRadius: tokens.radius.xl, height: tokens.size.logoLarge, width: "100%" },
  resultKicker: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  resultTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
  },
  quote: {
    borderLeftWidth: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight,
    paddingLeft: tokens.space.lg,
  },
  reference: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    paddingLeft: tokens.space.lg,
  },
  reflection: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  prayerCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.xl,
  },
  prayerKicker: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  prayer: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  privateNote: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  historySection: { gap: tokens.space.sm, marginTop: tokens.space.xl },
  historyKicker: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  historyItem: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
  historyDot: { borderRadius: tokens.radius.pill, height: tokens.space.sm, width: tokens.space.sm },
  historyCopy: { flex: 1 },
  historyTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  historyMeta: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  historyArrow: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
});
