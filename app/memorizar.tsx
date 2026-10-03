import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { nextReviewLabel } from "../convex/memorizeSchedule";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../src/components/ScreenHeader";
import {
  buildCloze,
  clearBlank,
  emptyFill,
  gradeCloze,
  isComplete,
  placeWord,
  usedBank,
  type ClozeFill,
} from "../src/features/personal/cloze";
import {
  nextPending,
  reviewFeedback,
  sessionProgress,
  sessionSummary,
  startSession,
  summaryCopy,
} from "../src/features/personal/memorizeSession";
import { openPassage } from "../src/lib/openPassage";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

type MemoryItem = FunctionReturnType<typeof api.memorize.list>["items"][number];

const formatRef = (item: { book: string; chapter: number; verse: number }) => `${item.book} ${item.chapter}:${item.verse}`;

/**
 * Memorizar (#158): repaso del día con un ejercicio de completar palabras, y
 * la lista de versículos con su próximo repaso. Se llega desde Mi espacio.
 *
 * No está en el prototype: se arma con piezas que ya existen (ScreenHeader,
 * la tarjeta de Guardados, los chips de Sentir, AppButton y la tarjeta con
 * renglones de Mi espacio). Cero tokens nuevos. Falta ratificarla en Claude
 * Design.
 *
 * Gratis y sin IA: el texto sale del corpus (`memorize.list`).
 */
export default function MemorizarScreen() {
  const { color } = useTheme();
  const data = useQuery(api.memorize.list, {});
  const review = useMutation(api.memorize.review);
  const remove = useMutation(api.memorize.remove);
  const [session, setSession] = useState<string[] | null>(null);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [round, setRound] = useState(0);

  // La sesión es una foto de lo que tocaba al abrir: se arma una sola vez.
  useEffect(() => {
    if (data && session === null) setSession(startSession(data.items));
  }, [data, session]);

  const current = session ? nextPending(session, results) : null;
  const currentItem = current ? data?.items.find((item) => item.id === current) ?? null : null;

  const confirmRemove = (item: MemoryItem) => {
    Alert.alert("¿Quitar de Memorizar?", `${formatRef(item)} sale de tu repaso y se pierde su avance.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => void remove({ book: item.book, chapter: item.chapter, verse: item.verse }).catch(() => undefined),
      },
    ]);
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Memorizar" titleSize="pick" />

      {data === undefined || session === null ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo tu repaso…</Text>
      ) : data.items.length === 0 ? (
        <View style={styles.empty} testID="memorize-empty">
          <Text style={[styles.emptyTitle, { color: color.inkMuted }]}>Todavía no estás memorizando nada</Text>
          <Text style={[styles.emptyBody, { color: color.inkFaint }]}>
            En el lector, tocá un versículo y elegí “Memorizar”. Al día siguiente aparece aquí para repasarlo. Si lo
            acertás, vuelve en 3 días, después en 7 y en 21; si fallás, lo repasás de nuevo ese mismo día.
          </Text>
        </View>
      ) : (
        <>
          {currentItem && currentItem.text !== null ? (
            <Exercise
              item={{ ...currentItem, text: currentItem.text }}
              key={`${currentItem.id}-${round}`}
              onDone={(correct) => setResults((value) => ({ ...value, [currentItem.id]: correct }))}
              onReview={(correct) => review({ id: currentItem.id as Id<"memoryVerses">, correct })}
              progress={sessionProgress(session, currentItem.id)}
              seed={`${formatRef(currentItem)}|${data.today}|${round}`}
              today={data.today}
            />
          ) : (
            <SessionDone
              onRetry={(failedIds) => {
                setSession(failedIds);
                setResults({});
                setRound((value) => value + 1);
              }}
              session={session}
              results={results}
            />
          )}

          <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>TUS VERSÍCULOS · {data.items.length}</Text>
          <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="memorize-list">
            {data.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.row, index > 0 && styles.rowDivider, index > 0 && { borderTopColor: color.border }]}
              >
                <Pressable
                  accessibilityHint="Abre el versículo en el lector."
                  accessibilityRole="button"
                  onPress={() => openPassage(item)}
                  style={({ pressed }) => [styles.rowText, pressed && styles.pressed]}
                >
                  <Text style={[styles.rowRef, { color: color.ink }]}>{formatRef(item)}</Text>
                  <Text style={[styles.rowHint, { color: item.due ? color.accent : color.inkSoft }]}>
                    {item.text === null
                      ? `No está en ${item.version}`
                      : `Próximo repaso: ${nextReviewLabel(item.nextReview, data.today).toLowerCase()}`}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Quitar ${formatRef(item)} de Memorizar`}
                  accessibilityRole="button"
                  hitSlop={tokens.space.sm}
                  onPress={() => confirmRemove(item)}
                  testID="memorize-remove"
                >
                  <Text style={[styles.rowAction, { color: color.inkSoft }]}>Quitar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
    </AppScreen>
  );
}

type ExerciseProps = {
  item: MemoryItem & { text: string };
  progress: string;
  seed: string;
  today: string;
  onReview: (correct: boolean) => Promise<{ level: number; nextReview: string }>;
  onDone: (correct: boolean) => void;
};

/** Un versículo con huecos y el banco de palabras para tocar. */
function Exercise({ item, progress, seed, today, onReview, onDone }: ExerciseProps) {
  const { color } = useTheme();
  const cloze = useMemo(() => buildCloze(item.text, item.level, seed), [item.text, item.level, seed]);
  const [filled, setFilled] = useState<ClozeFill>(() => emptyFill(cloze));
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const used = usedBank(filled);

  const submit = async (correct: boolean) => {
    try {
      const next = await onReview(correct);
      setResult({ correct, feedback: reviewFeedback(correct, next.nextReview, today) });
      setError(null);
    } catch {
      setError("No pudimos guardar tu repaso. Revisá tu conexión e intentá de nuevo.");
    }
  };

  return (
    <View style={[styles.card, styles.exercise, { backgroundColor: color.surface, borderColor: color.border }]} testID="memorize-exercise">
      <Text style={[styles.kind, { color: color.accent }]}>REPASO DE HOY · {progress}</Text>
      <Text style={[styles.reference, { color: color.ink }]}>{formatRef(item)}</Text>

      {result ? (
        <Text style={[styles.verse, { color: color.ink }]} testID="memorize-full-verse">
          “{item.text}”
        </Text>
      ) : (
        <Text style={[styles.verse, { color: color.ink }]} testID="memorize-cloze">
          {cloze.parts.map((part, index) => {
            if (part.kind === "text") return <Text key={index}>{part.text}</Text>;
            const bankIndex = filled[part.blank];
            const word = bankIndex === null ? null : cloze.bank[bankIndex];
            return (
              <Text
                accessibilityHint={word ? "Tocá para sacar esta palabra." : undefined}
                accessibilityLabel={word ?? "Espacio vacío"}
                key={index}
                onPress={word ? () => setFilled((value) => clearBlank(value, part.blank)) : undefined}
                style={[styles.blank, { color: word ? color.accentDeep : color.inkFaint }]}
                testID={`memorize-blank-${part.blank}`}
              >
                {word ?? "＿".repeat(Math.max(3, Math.ceil(cloze.answers[part.blank].length / 2)))}
              </Text>
            );
          })}
        </Text>
      )}

      {result ? (
        <>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.feedback, { color: result.correct ? color.sage : color.accentDeep }]}
            testID="memorize-feedback"
          >
            {result.feedback}
          </Text>
          <AppButton onPress={() => onDone(result.correct)} testID="memorize-next">
            Siguiente
          </AppButton>
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: color.inkSoft }]}>Tocá las palabras en orden para completar el versículo.</Text>
          <View style={styles.bank} testID="memorize-bank">
            {cloze.bank.map((word, index) => {
              const isUsed = used.has(index);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isUsed }}
                  disabled={isUsed}
                  key={`${word}-${index}`}
                  onPress={() => setFilled((value) => placeWord(value, index))}
                  style={[
                    styles.chip,
                    { backgroundColor: isUsed ? color.surfaceSunk : color.surface, borderColor: isUsed ? color.border : color.borderStrong },
                  ]}
                  testID={`memorize-word-${index}`}
                >
                  <Text style={[styles.chipLabel, { color: isUsed ? color.inkFaint : color.ink }]}>{word}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={[styles.hint, { color: color.accentDeep }]}>
              {error}
            </Text>
          ) : null}
          <AppButton disabled={!isComplete(filled)} onPress={() => void submit(gradeCloze(cloze, filled))} testID="memorize-check">
            Revisar
          </AppButton>
          <AppButton onPress={() => void submit(false)} testID="memorize-give-up" variant="quiet">
            No me acuerdo
          </AppButton>
        </>
      )}
    </View>
  );
}

type SessionDoneProps = {
  session: string[];
  results: Record<string, boolean>;
  onRetry: (failedIds: string[]) => void;
};

function SessionDone({ session, results, onRetry }: SessionDoneProps) {
  const { color } = useTheme();
  const summary = sessionSummary(session, results);
  return (
    <View style={[styles.card, styles.exercise, { backgroundColor: color.surfaceSunk, borderColor: color.border }]} testID="memorize-done">
      <Text style={[styles.kind, { color: color.sage }]}>REPASO DE HOY</Text>
      <Text style={[styles.reference, { color: color.ink }]}>
        {summary.total === 0 ? "Nada para repasar hoy" : "Listo por hoy"}
      </Text>
      <Text style={[styles.hint, { color: color.inkMuted }]}>
        {summary.total === 0 ? "Volvé mañana: los versículos nuevos aparecen al día siguiente." : summaryCopy(summary)}
      </Text>
      {summary.failedIds.length > 0 ? (
        <AppButton onPress={() => onRetry(summary.failedIds)} testID="memorize-retry" variant="secondary">
          Repasar los que fallé
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  empty: { alignItems: "center", gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  exercise: { gap: tokens.space.md, padding: tokens.space.xl },
  kind: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  reference: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  // Mismo versículo en serif que la tarjeta de Guardados.
  verse: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  blank: { textDecorationLine: "underline" },
  hint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  feedback: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Mismos chips que los sentimientos de Sentir.
  bank: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chip: { borderRadius: tokens.radius.pill, borderWidth: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  chipLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Etiqueta de sección y renglones: los de Ajustes / Mi espacio.
  sectionLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginBottom: -tokens.space.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  rowRef: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.bodySm.lineHeight },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  rowAction: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
});
