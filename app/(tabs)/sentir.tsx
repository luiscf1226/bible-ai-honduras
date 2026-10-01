import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { LinearGradient } from "expo-linear-gradient";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { BottomPanel } from "../../src/components/BottomPanel";
import { FEELING_GEN_STEPS, LoadingState } from "../../src/components/LoadingState";
import { LimitReached } from "../../src/components/LimitReached";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { SideDrawer } from "../../src/components/SideDrawer";
import { api } from "../../convex/_generated/api";
import { FEELINGS, OWN_WORDS_CHIP, feelingFromParam } from "../../src/features/feelings/feelings";
import { journeyCtaLabel, journeyForFeelings } from "../../src/features/reading/feelingJourneys";
import { openReadingPlan } from "../../src/lib/openPassage";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [writingOwn, setWritingOwn] = useState(false);
  const freeTextRef = useRef<TextInput>(null);
  // Desde el inicio se puede llegar con un sentimiento ya elegido
  // (`?feeling=Ansiedad`) o directo a escribir (`?escribir=1`).
  const params = useLocalSearchParams<{ feeling?: string | string[]; escribir?: string | string[] }>();
  const paramFeeling = feelingFromParam(params.feeling);
  const paramWrite = (Array.isArray(params.escribir) ? params.escribir[0] : params.escribir) === "1";
  useEffect(() => {
    if (paramFeeling) setSelectedFeelings((current) => (current.includes(paramFeeling) ? current : [...current, paramFeeling]));
  }, [paramFeeling]);
  useEffect(() => {
    if (!paramWrite) return;
    setWritingOwn(true);
    // Espera a que el panel monte el campo antes de enfocarlo.
    const timer = setTimeout(() => freeTextRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [paramWrite]);
  const startWritingOwn = () => {
    setWritingOwn(true);
    freeTextRef.current?.focus();
  };
  const generateRequestIdRef = useRef(0);
  const historicalConversation = useQuery(
    getHistoryConversation,
    selectedHistoryId ? { conversationId: selectedHistoryId } : "skip",
  );
  const historicalDevotional =
    historicalConversation?.messages.find((message) => message.devotional)?.devotional ?? null;
  const activeDevotional = devotional ?? historicalDevotional;
  // Puente al recorrido del mismo tema (#115). Solo para un devocional recién
  // generado: los del historial no guardan qué sentimientos se eligieron, y
  // los chips seleccionados en pantalla podrían no ser los de ese devocional.
  const journey = devotional ? journeyForFeelings(selectedFeelings) : null;
  const journeyPlan = useQuery(api.readingPlans.catalog, journey ? { planId: journey.planId } : "skip");

  const toggleFeeling = (feeling: string) => {
    setSelectedFeelings((current) =>
      current.includes(feeling) ? current.filter((selected) => selected !== feeling) : [...current, feeling],
    );
  };

  const canGenerate = selectedFeelings.length > 0 || freeText.trim().length > 0;

  const generateDevotional = async (options?: { force?: boolean }) => {
    if (!canGenerate || (isGenerating && !options?.force)) return;
    const requestId = ++generateRequestIdRef.current;
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generate({ feelings: selectedFeelings, note: freeText });
      if (requestId !== generateRequestIdRef.current) {
        return;
      }
      if (!result.allowed) {
        setLimitReached(true);
        return;
      }
      setDevotional(result.devotional);
    } catch (cause) {
      if (requestId !== generateRequestIdRef.current) {
        return;
      }
      setError(cause instanceof Error ? cause.message : "No pudimos preparar tu devocional. Intentá de nuevo.");
    } finally {
      if (requestId === generateRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);
  if (atLimit && !activeDevotional) {
    return <LimitReached module="feelings" testID="feelings-limit" />;
  }

  if (isGenerating) {
    return (
      <AppScreen contentStyle={styles.generatingContent} style={{ backgroundColor: color.bg }}>
        <LoadingState
          detail="Tomá un respiro mientras tanto."
          onRetry={() => void generateDevotional({ force: true })}
          showBrand
          steps={FEELING_GEN_STEPS}
          testID="sentir-generating"
        />
      </AppScreen>
    );
  }

  if (selectedHistoryId && historicalConversation === undefined) {
    const historyId = selectedHistoryId;
    return (
      <AppScreen contentStyle={styles.generatingContent} style={{ backgroundColor: color.bg }}>
        <LoadingState
          message="Abriendo tu devocional…"
          onRetry={() => {
            // Re-suscribe la query: skip → id (Convex no expone invalidate).
            setSelectedHistoryId(null);
            requestAnimationFrame(() => setSelectedHistoryId(historyId));
          }}
          testID="sentir-history-loading"
        />
      </AppScreen>
    );
  }

  if (activeDevotional) {
    const reference = `${activeDevotional.citation.book} ${activeDevotional.citation.chapter}:${activeDevotional.citation.verse} · ${activeDevotional.citation.version}`;
    return (
      <AppScreen scroll contentStyle={styles.resultContent}>
        <ScreenHeader
          accessibilityLabel="Volver a sentimiento"
          onBack={() => {
            setDevotional(null);
            setSelectedHistoryId(null);
          }}
          testID="sentir-result-back"
        />
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
        {journey && journeyPlan ? (
          <AppButton
            onPress={() => openReadingPlan(journeyPlan.id)}
            testID="sentir-journey-cta"
            variant="secondary"
          >
            {journeyCtaLabel(journeyPlan.totalDays, journey.topic)}
          </AppButton>
        ) : null}
        <AppButton onPress={() => void generateDevotional()} variant="secondary">
          Dame otro enfoque
        </AppButton>
        <Text style={[styles.privateNote, { color: color.inkSoft }]}>
          Este devocional es privado. No se comparte ni se publica.
        </Text>
      </AppScreen>
    );
  }

  const quotaLabel = quota?.isPro
    ? "Pro · sin límite"
    : `${quota?.remaining ?? "…"} de ${quota?.limit ?? "…"} devocionales gratis hoy`;
  const hasSelection = selectedFeelings.length > 0;
  const selectionSummary = hasSelection
    ? `Escogiste: ${selectedFeelings.join(" · ")}`
    : freeText.trim().length > 0
      ? "Con tus palabras. También puedes sumar un sentimiento."
      : "Toca uno o más, o escribe el tuyo abajo.";

  return (
    <AppScreen contentStyle={styles.selectContent}>
      <ScrollView
        contentContainerStyle={styles.intro}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        style={styles.introScroll}
      >
        <View style={styles.topRow}>
          <ScreenHeader
            accessibilityLabel="Volver al inicio"
            onBack={() => router.replace("/home")}
            testID="sentir-back"
          />
          {/* El historial vive en un cajón a la izquierda (pedido de la beta):
              arriba de la pantalla empujaba los sentimientos hacia abajo. */}
          {pastDevotionals.length > 0 ? (
            <Pressable
              accessibilityHint="Abre tus devocionales anteriores en un panel a la izquierda."
              accessibilityRole="button"
              onPress={() => setIsHistoryOpen(true)}
              style={({ pressed }) => [
                styles.historyButton,
                { backgroundColor: color.surface, borderColor: color.border },
                pressed && styles.pressed,
              ]}
              testID="sentir-history-open"
            >
              <View style={[styles.historyDot, { backgroundColor: color.sage }]} />
              <Text style={[styles.historyButtonLabel, { color: color.ink }]}>
                Los de antes · {pastDevotionals.length}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View>
          <Text style={[styles.title, { color: color.ink }]}>¿Qué llevas encima hoy?</Text>
          <Text style={[styles.description, { color: color.inkMuted }]}>
            Escoge lo que más se parezca, o escríbelo con tus palabras. Esto queda solo entre tú y la app.
          </Text>
        </View>

      </ScrollView>

      <SideDrawer onClose={() => setIsHistoryOpen(false)} testID="sentir-history" title="Los de antes" visible={isHistoryOpen}>
        {pastDevotionals.map((item) => (
          <Pressable
            accessibilityHint="Abre este devocional anterior."
            accessibilityRole="button"
            key={item.id}
            onPress={() => {
              setIsHistoryOpen(false);
              setSelectedHistoryId(item.id);
            }}
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
      </SideDrawer>

      <BottomPanel
        bodyStyle={styles.panelBody}
        footer={
          <>
            <Text style={[styles.inputLabel, { color: writingOwn ? color.accent : color.inkSoft }]}>
              {writingOwn ? "ESCRÍBELO CON TUS PALABRAS" : "O ESCRÍBELO CON TUS PALABRAS"}
            </Text>
            <TextInput
              accessibilityLabel="Escribe cómo te sientes con tus palabras"
              multiline
              onChangeText={setFreeText}
              onFocus={() => setWritingOwn(true)}
              placeholder={
                writingOwn
                  ? "Por ejemplo: “Me siento solo desde que me mudé”."
                  : "Si ninguno se parece, cuéntame aquí cómo te sientes."
              }
              placeholderTextColor={color.inkFaint}
              style={[
                styles.input,
                { backgroundColor: color.surface, borderColor: writingOwn ? color.accent : color.border, color: color.ink },
              ]}
              ref={freeTextRef}
              testID="sentir-free-text"
              textAlignVertical="top"
              value={freeText}
            />
            {error ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: color.accentDeep }]}>
                {error}
              </Text>
            ) : null}
            <AppButton
              disabled={!canGenerate}
              onPress={() => void generateDevotional()}
              testID="generate-feeling-devotional"
            >
              Prepárame un devocional
            </AppButton>
            <Text style={[styles.disclaimer, { color: color.inkFaint }]}>
              Acompañamiento, no consejo pastoral ni atención en crisis.
            </Text>
          </>
        }
        header={
          <>
            <Text style={[styles.quota, { color: color.inkSoft }]}>{quotaLabel}</Text>
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={2}
              style={[
                styles.selection,
                hasSelection
                  ? { color: color.ink, fontFamily: tokens.font.sansMedium }
                  : { color: color.inkSoft, fontFamily: tokens.font.sansLight },
              ]}
            >
              {selectionSummary}
            </Text>
          </>
        }
        testID="sentir-panel"
      >
        <View accessibilityLabel="Selecciona uno o más sentimientos" style={styles.chips}>
          {/* Primero, para que se vea sin scrollear: "mi sentimiento no está". */}
          <Pressable
            accessibilityHint="Lleva al campo para escribir lo que sientes con tus palabras."
            accessibilityRole="button"
            onPress={startWritingOwn}
            style={[
              styles.chip,
              styles.ownChip,
              { borderColor: color.accent },
              writingOwn && { backgroundColor: color.surfaceSunk },
            ]}
            testID="sentir-own-words"
          >
            <Text style={[styles.chipLabel, { color: color.accentDeep }]}>{OWN_WORDS_CHIP}</Text>
          </Pressable>
          {FEELINGS.map((feeling) => {
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
      </BottomPanel>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // El panel inferior sangra hasta los bordes, así que el padding horizontal y
  // el de abajo dejan de ser del contenedor y pasan a cada zona (issue #109).
  selectContent: { paddingBottom: 0, paddingHorizontal: 0 },
  introScroll: { flex: 1 },
  intro: {
    gap: tokens.space.xl,
    paddingBottom: tokens.space.xl,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  // Techo de la lista de chips: garantiza que el campo libre y el CTA entran en
  // pantalla incluso en un iPhone SE. El piso deja siempre una fila asomada,
  // para que se lea que la lista sigue. Los dos valores salen de tokens.
  panelBody: { maxHeight: tokens.size.logoLarge * 2, minHeight: tokens.size.logoSmall },
  selection: {
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
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
    // Dentro del panel el campo arranca en una línea y crece con el texto hasta
    // topar: de ahí en adelante scrollea adentro en vez de empujar el CTA fuera
    // de pantalla (issues #105 y #109). El tope sale de un token, no es medida
    // nueva.
    maxHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
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
  generatingContent: { flex: 1, justifyContent: "center", paddingHorizontal: 0 },
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
  topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  pressed: { opacity: tokens.opacity.pressed },
  historyButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  historyButtonLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  ownChip: { borderStyle: "dashed" },
  inputLabel: {
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
