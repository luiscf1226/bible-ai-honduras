import { useEffect, useReducer, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { api } from "../../convex/_generated/api";
import { FEELING_GEN_STEPS, LoadingState } from "../../src/components/LoadingState";
import { LimitReached } from "../../src/components/LimitReached";
import { PersonalLockGate } from "../../src/components/PersonalLockGate";
import { DevotionalMessage } from "../../src/features/feelings/DevotionalMessage";
import { EmptyThread, UserBubble } from "../../src/features/feelings/FeelingMessages";
import { FeelingsComposer } from "../../src/features/feelings/FeelingsComposer";
import { HistoryDrawer } from "../../src/features/feelings/HistoryDrawer";
import { SentirHeader } from "../../src/features/feelings/SentirHeader";
import { feelingFromParam } from "../../src/features/feelings/feelings";
import { goToPause } from "../../src/features/pause/goToPause";
import {
  INITIAL_THREAD,
  bottomSlotFor,
  canSend,
  quotaLabel,
  showFollowUps,
  threadReducer,
  toggleFeeling,
  turnsFromHistory,
  withFeeling,
  type FeelingDevotional,
  type StoredMessage,
} from "../../src/features/feelings/thread";
import { useScreenInsets, useScrollToEndOnKeyboard } from "../../src/hooks/useKeyboardAvoidance";
import { goToChat } from "../../src/lib/goToChat";
import { keyboardBehaviorFor, keyboardVerticalOffsetFor } from "../../src/lib/keyboardAvoidance";
import { track } from "../../src/lib/telemetry";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";
import { RequiresConnection } from "../../src/features/offline/RequiresConnection";

// La única llamada de generación de Sentir (regla dura #4): no hay chat libre.
const generateFeelingDevotional = makeFunctionReference<
  "action",
  { feelings: string[]; note?: string },
  | { allowed: true; conversationId: string; devotional: FeelingDevotional }
  | { allowed: false; reason: "limit_reached"; module: "feelings" }
>("feelings:generate");

const getHistoryConversation = makeFunctionReference<
  "query",
  { conversationId: string },
  { module: "qa" | "voices" | "feelings"; messages: StoredMessage[] } | null
>("history:getById");

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Sentir como un chat (#197, U5): composer fijo abajo con los sentimientos
 * como chips, el devocional llega como mensaje del hilo, y "Los de antes" vive
 * en el cajón de la izquierda. La lógica pura está en
 * `src/features/feelings/thread.ts`.
 */
function SentirScreenContent() {
  const { color } = useTheme();
  const insets = useScreenInsets();
  const threadRef = useRef<ScrollView>(null);
  useScrollToEndOnKeyboard(threadRef);
  const inputRef = useRef<TextInput>(null);

  const generate = useAction(generateFeelingDevotional);
  const currentUser = useQuery(api.users.current);
  const pastDevotionals = useQuery(api.history.list, {})?.filter((item) => item.module === "feelings") ?? [];
  const quota = useQuery(api.quotas.remaining, { module: "feelings" });

  const [thread, dispatch] = useReducer(threadReducer, INITIAL_THREAD);
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const turnIdRef = useRef(0);
  const nextTurnId = () => `t${++turnIdRef.current}`;

  // Desde el inicio se llega con un sentimiento ya elegido (`?feeling=Ansiedad`)
  // o directo a escribir (`?escribir=1`). Desde Mi espacio, con "Los de antes"
  // abierto (`?historial=1`).
  const params = useLocalSearchParams<{
    feeling?: string | string[];
    escribir?: string | string[];
    historial?: string | string[];
  }>();
  const paramFeeling = feelingFromParam(params.feeling);
  const paramWrite = firstParam(params.escribir) === "1";
  const paramHistory = firstParam(params.historial) === "1";
  useEffect(() => {
    if (paramHistory) setIsDrawerOpen(true);
  }, [paramHistory]);
  useEffect(() => {
    if (paramFeeling) setSelectedFeelings((current) => withFeeling(current, paramFeeling));
  }, [paramFeeling]);
  useEffect(() => {
    if (!paramWrite) return;
    // Espera a que el composer monte antes de enfocar el campo.
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [paramWrite]);

  // Abrir uno de "Los de antes" lo muestra en el hilo, sin generar.
  const historicalConversation = useQuery(
    getHistoryConversation,
    selectedHistoryId ? { conversationId: selectedHistoryId } : "skip",
  );
  useEffect(() => {
    if (!selectedHistoryId || historicalConversation === undefined) return;
    if (historicalConversation) {
      dispatch({ type: "historyOpened", turns: turnsFromHistory(selectedHistoryId, historicalConversation.messages) });
    } else {
      dispatch({ type: "failed", message: "No encontramos ese devocional." });
    }
    setSelectedHistoryId(null);
  }, [historicalConversation, selectedHistoryId]);

  const runGenerate = async (input: { feelings: string[]; note: string }) => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await generate({ feelings: input.feelings, note: input.note });
      if (requestId !== requestIdRef.current) return;
      if (!result.allowed) {
        setLimitReached(true);
        dispatch({ type: "limitReached" });
        return;
      }
      dispatch({ type: "generated", id: nextTurnId(), devotional: result.devotional });
      track("feeling_devotional_generated");
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      // Lo que había escrito vuelve al composer para reintentar.
      setSelectedFeelings(input.feelings);
      setNote(input.note);
      dispatch({
        type: "failed",
        message: cause instanceof Error ? cause.message : "No pudimos preparar tu devocional. Intentá de nuevo.",
      });
    }
  };

  const onSend = () => {
    if (!canSend(selectedFeelings, note) || thread.pending) return;
    const input = { feelings: selectedFeelings, note };
    dispatch({ type: "sent", id: nextTurnId(), ...input });
    setSelectedFeelings([]);
    setNote("");
    Keyboard.dismiss();
    void runGenerate(input);
  };

  const startNew = () => {
    // Una respuesta en vuelo ya no es de este hilo.
    requestIdRef.current += 1;
    setSelectedHistoryId(null);
    setIsDrawerOpen(false);
    setSelectedFeelings([]);
    setNote("");
    dispatch({ type: "reset" });
  };

  const openPast = (id: string) => {
    requestIdRef.current += 1;
    setIsDrawerOpen(false);
    setSelectedHistoryId(id);
  };

  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);
  const slot = bottomSlotFor(thread, atLimit);
  const isEmpty = thread.turns.length === 0 && !thread.pending && !selectedHistoryId;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]}>
      <KeyboardAvoidingView
        behavior={keyboardBehaviorFor(Platform.OS)}
        keyboardVerticalOffset={keyboardVerticalOffsetFor({ insets, platform: Platform.OS })}
        style={styles.flex}
      >
        <SentirHeader onClose={() => router.replace("/home")} onOpenDrawer={() => setIsDrawerOpen(true)} />

        <ScrollView
          contentContainerStyle={isEmpty ? styles.emptyContent : styles.thread}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // Con el teclado abierto, el primer tap en una acción no tiene que
          // gastarse en cerrarlo.
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!isEmpty) threadRef.current?.scrollToEnd({ animated: true });
          }}
          ref={threadRef}
          style={styles.flex}
        >
          {isEmpty ? <EmptyThread /> : null}
          {thread.turns.map((turn, index) =>
            turn.kind === "user" ? (
              <UserBubble key={turn.id} turn={turn} />
            ) : (
              <DevotionalMessage
                followUps={
                  showFollowUps(thread, index)
                    ? {
                        // En el límite no se ofrece otro: abajo ya está el aviso.
                        onAnother: atLimit ? null : () => dispatch({ type: "anotherRequested" }),
                        onAsk: () =>
                          goToChat({
                            book: turn.devotional.citation.book,
                            chapter: turn.devotional.citation.chapter,
                            verse: turn.devotional.citation.verse,
                          }),
                        // Solo la cita viaja a la pausa: nada de lo que la persona contó.
                        onPause: () =>
                          goToPause({
                            book: turn.devotional.citation.book,
                            chapter: turn.devotional.citation.chapter,
                            verse: turn.devotional.citation.verse,
                          }),
                      }
                    : null
                }
                key={turn.id}
                referralCode={currentUser?.referralCode}
                turn={turn}
              />
            ),
          )}
          {thread.pending ? (
            <LoadingState
              onRetry={() => {
                if (thread.pending) void runGenerate(thread.pending);
              }}
              steps={FEELING_GEN_STEPS}
              testID="sentir-generating"
              variant="inline"
            />
          ) : null}
          {selectedHistoryId ? (
            <LoadingState message="Abriendo tu devocional…" testID="sentir-history-loading" variant="inline" />
          ) : null}
        </ScrollView>

        {slot === "composer" ? (
          <FeelingsComposer
            error={thread.error}
            inputRef={inputRef}
            note={note}
            onChangeNote={setNote}
            onSend={onSend}
            onToggle={(feeling) => setSelectedFeelings((current) => toggleFeeling(current, feeling))}
            quotaLabel={quotaLabel(quota)}
            selected={selectedFeelings}
          />
        ) : null}
        {slot === "limit" ? (
          <View style={[styles.limitSlot, { borderTopColor: color.border }]}>
            <LimitReached module="feelings" testID="feelings-limit" variant="inline" />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <HistoryDrawer
        items={pastDevotionals}
        onClose={() => setIsDrawerOpen(false)}
        onNew={startNew}
        onOpen={openPast}
        visible={isDrawerOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  emptyContent: { flexGrow: 1 },
  thread: {
    gap: tokens.space.lg,
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.space.xl,
  },
  limitSlot: {
    borderTopWidth: 1,
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
});

/**
 * "Proteger lo personal" (#171): si está encendido, nada se monta hasta
 * autenticar. Sin señal no puede responder: se avisa en vez de quedarse
 * cargando (#160).
 */
export default function SentirScreen() {
  return (
    <PersonalLockGate>
      <RequiresConnection module="feelings">
        <SentirScreenContent />
      </RequiresConnection>
    </PersonalLockGate>
  );
}
