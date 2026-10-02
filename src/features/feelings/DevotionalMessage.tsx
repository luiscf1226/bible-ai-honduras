import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { CitationLink } from "../../components/CitationLink";
import { Icon, type IconName } from "../../components/Icon";
import { openPassage, openReadingPlan } from "../../lib/openPassage";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { journeyCtaLabel, journeyForFeelings } from "../reading/feelingJourneys";
import { shareVerse } from "../reading/shareVerse";
import type { DevotionalTurn } from "./thread";

type DevotionalMessageProps = {
  turn: DevotionalTurn;
  referralCode: string | undefined;
  /** Chips de seguimiento: solo debajo del último devocional. */
  followUps: null | { onAnother: (() => void) | null; onAsk: () => void };
};

/**
 * El devocional como mensaje del hilo (design/oleada-ux.md §U5): tarjeta a
 * todo el ancho con título, versículo, cita tocable (#192), reflexión, oración
 * y acciones. Debajo, los dos únicos caminos para seguir: no hay chat libre.
 */
export function DevotionalMessage({ followUps, referralCode, turn }: DevotionalMessageProps) {
  const { color } = useTheme();
  const { citation, prayer, reflection, title } = turn.devotional;
  // Puente al recorrido del mismo tema (#115), con los sentimientos que se
  // pidieron para este devocional.
  const journey = journeyForFeelings(turn.feelings);
  const journeyPlan = useQuery(api.readingPlans.catalog, journey ? { planId: journey.planId } : "skip");

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="sentir-devotional">
        <Text style={[styles.kicker, { color: color.accent }]}>{title}</Text>
        <Text style={[styles.quote, { borderLeftColor: color.borderStrong, color: color.ink }]}>“{citation.text}”</Text>
        <CitationLink
          book={citation.book}
          chapter={citation.chapter}
          from="feelings"
          testID="sentir-citation"
          variant="block"
          verse={citation.verse}
          version={citation.version}
        />
        <Text style={[styles.reflection, { color: color.inkMuted }]}>{reflection}</Text>
        <View style={[styles.prayerCard, { backgroundColor: color.surfaceSunk }]}>
          <Text style={[styles.kicker, { color: color.accent }]}>UNA ORACIÓN CORTA</Text>
          <Text style={[styles.prayer, { color: color.ink }]}>{prayer}</Text>
        </View>
        <View style={[styles.actions, { borderTopColor: color.border }]}>
          <Action
            disabled={!referralCode}
            hint={referralCode ? "Comparte el versículo. Lo que contaste no se comparte." : "Esperá mientras cargamos tu perfil."}
            icon="share"
            label="Compartir"
            onPress={() => {
              if (!referralCode) return;
              // Solo el versículo: lo que la persona contó es privado.
              void shareVerse({ verse: citation, referralCode });
            }}
            testID="sentir-share"
          />
          <Action
            icon="book"
            label="Leer el capítulo"
            onPress={() => openPassage({ book: citation.book, chapter: citation.chapter, verse: citation.verse })}
            testID="sentir-read-chapter"
          />
          {journey && journeyPlan ? (
            <Action
              accessibilityLabel={journeyCtaLabel(journeyPlan.totalDays, journey.topic)}
              icon="calendar"
              label="Recorrido"
              onPress={() => openReadingPlan(journeyPlan.id)}
              testID="sentir-journey-cta"
            />
          ) : null}
        </View>
      </View>
      {followUps ? (
        <View style={styles.followUps}>
          {followUps.onAnother ? (
            <FollowUpChip label="Otro devocional" onPress={followUps.onAnother} testID="sentir-another" />
          ) : null}
          <FollowUpChip label="Tengo una pregunta sobre esto" onPress={followUps.onAsk} testID="sentir-ask" />
        </View>
      ) : null}
    </View>
  );
}

function Action({
  accessibilityLabel,
  disabled = false,
  hint,
  icon,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  hint?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={tokens.space.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      testID={testID}
    >
      <Icon color={color.accent} name={icon} size="sm" />
      <Text style={[styles.actionLabel, { color: color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

function FollowUpChip({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: color.surface, borderColor: color.borderStrong },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <Text style={[styles.chipLabel, { color: color.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.lg,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  kicker: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  quote: {
    borderLeftWidth: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    fontStyle: "italic",
    lineHeight: tokens.type.subtitle.lineHeight,
    paddingLeft: tokens.space.lg,
  },
  reflection: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  prayerCard: {
    borderRadius: tokens.radius.lg,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  prayer: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    fontStyle: "italic",
    lineHeight: tokens.type.versePicker.lineHeight,
  },
  actions: {
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space.xl,
    paddingTop: tokens.space.md,
  },
  action: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  actionLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  followUps: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
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
  pressed: { opacity: tokens.opacity.pressed },
});
