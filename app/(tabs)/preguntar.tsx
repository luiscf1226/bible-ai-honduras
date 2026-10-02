import { useAction, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEFAULT_BIBLE_VERSION } from "../../convex/bibleVersions";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Icon } from "../../src/components/Icon";
import { LoadingState, QA_ANSWER_STEPS } from "../../src/components/LoadingState";
import { goBackOrHome } from "../../src/components/ScreenHeader";
import { PassageSheet } from "../../src/features/qa/PassageSheet";
import { QaComposer } from "../../src/features/qa/QaComposer";
import { QaDrawer } from "../../src/features/qa/QaDrawer";
import { QaEmptyState } from "../../src/features/qa/QaEmptyState";
import { QaMessage, type QaThreadMessage } from "../../src/features/qa/QaMessage";
import { composerSuggestions, samePassage } from "../../src/features/qa/suggestions";
import type { PassageQuery } from "../../src/features/reading/bookSearch";
import { useScreenInsets, useScrollToEndOnKeyboard } from "../../src/hooks/useKeyboardAvoidance";
import { readChatParams } from "../../src/lib/goToChat";
import { keyboardBehaviorFor, keyboardVerticalOffsetFor } from "../../src/lib/keyboardAvoidance";
import { track } from "../../src/lib/telemetry";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";
import { RequiresConnection } from "../../src/features/offline/RequiresConnection";

const CONVERSATIONS_LIMIT = 30;

type QaConversationId = Id<"conversations">;

/**
 * Preguntar (U6, #198): se pregunta primero y el pasaje se elige después, con
 * el chip encima del campo. Una conversación por tema (#191): elegir otro
 * pasaje o "Nueva pregunta" abre un hilo limpio; el anterior queda en el cajón.
 *
 * Params (`src/lib/goToChat.ts`): `book/chapter/verse` precargan el chip
 * (lector, Sentir, `/hoy`, Historias), `conversationId` retoma un hilo y
 * `pregunta` prellena el campo sin enviarlo (tarjeta del inicio).
 *
 * Las respuestas salen solo de `api.qa.ask` → RAG (regla dura #4).
 */
function PreguntarScreenContent() {
  const { color } = useTheme();
  const insets = useScreenInsets();
  const threadRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  useScrollToEndOnKeyboard(threadRef);

  const rawParams = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    verse?: string;
    conversationId?: string;
    pregunta?: string;
  }>();
  const initial = useMemo(
    () => readChatParams(rawParams),
    // Los params llegan como strings nuevos en cada render: se compara por valor.
    [rawParams.book, rawParams.chapter, rawParams.verse, rawParams.conversationId, rawParams.pregunta],
  );

  const [passage, setPassage] = useState<PassageQuery | null>(initial.passage);
  const [conversationId, setConversationId] = useState<QaConversationId | undefined>(
    initial.conversationId as QaConversationId | undefined,
  );
  const [draft, setDraft] = useState(initial.pregunta);
  const [busy, setBusy] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const lastQuestionRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  // Si la misma pantalla recibe params nuevos (otro `goToChat` sin desmontar),
  // se adopta ese contexto como si se abriera de cero.
  const firstParams = useRef(true);
  useEffect(() => {
    if (firstParams.current) {
      firstParams.current = false;
      return;
    }
    requestIdRef.current += 1;
    setBusy(false);
    setPendingQuestion(null);
    setPassage(initial.passage);
    setConversationId(initial.conversationId as QaConversationId | undefined);
    setDraft(initial.pregunta);
  }, [initial]);

  const thread = useQuery(api.qa.thread, conversationId ? { conversationId } : "skip");
  const conversations = useQuery(api.qa.conversations, { limit: CONVERSATIONS_LIMIT });
  const currentUser = useQuery(api.users.current);
  const quota = useQuery(api.quotas.remaining, currentUser ? { module: "qa" } : "skip");
  const ask = useAction(api.qa.ask);
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;

  const messages: QaThreadMessage[] = useMemo(
    () =>
      (conversationId ? thread ?? [] : []).map((message, index, all) => ({
        key: message._id,
        role: message.role,
        text: message.text,
        citation: message.citations?.[0] ?? null,
        question: message.role === "assistant" ? all[index - 1]?.text ?? null : null,
      })),
    [conversationId, thread],
  );
  const hasAnswer = messages.some((message) => message.role === "assistant");
  const threadLoading = conversationId !== undefined && thread === undefined;

  const title = conversations?.find((item) => item._id === conversationId)?.title ?? "Preguntar";
  const quotaLabel = !quota ? null : quota.isPro ? "Pro · sin límite" : `${quota.remaining} de ${quota.limit} preguntas gratis hoy`;
  const atLimit = limitReached || (quota !== undefined && !quota.isPro && quota.remaining === 0);

  /** Hilo limpio: cualquier respuesta en vuelo del hilo anterior se ignora. */
  const startThread = (next: { passage: PassageQuery | null; conversationId?: QaConversationId }) => {
    requestIdRef.current += 1;
    setBusy(false);
    setPendingQuestion(null);
    setPassage(next.passage);
    setConversationId(next.conversationId);
  };

  const sendQuestion = async (question: string) => {
    const requestId = ++requestIdRef.current;
    lastQuestionRef.current = question;
    setBusy(true);
    setPendingQuestion(question);
    try {
      const result = await ask({ question, passage: passage ?? undefined, conversationId });
      if (requestId !== requestIdRef.current) return;
      if (result.conversationId) setConversationId(result.conversationId);
      if (result.status === "limit_reached") {
        setLimitReached(true);
      } else if (result.status === "ok") {
        track("qa_asked");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setBusy(false);
        setPendingQuestion(null);
      }
    }
  };

  const onSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || atLimit) return;
    setDraft("");
    void sendQuestion(trimmed);
  };

  const choosePassage = (next: PassageQuery | null) => {
    if (samePassage(next, passage)) return;
    // El pasaje define el tema: otro pasaje (o quitarlo) es un hilo nuevo y el
    // anterior queda en el cajón (#191).
    startThread({ passage: next });
    inputRef.current?.focus();
  };

  const newQuestion = () => {
    setDrawerOpen(false);
    startThread({ passage: null });
    setDraft("");
    inputRef.current?.focus();
  };

  const openConversation = (id: string) => {
    setDrawerOpen(false);
    const conversation = conversations?.find((item) => item._id === id);
    startThread({ passage: conversation?.passage ?? null, conversationId: id as QaConversationId });
    setDraft("");
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]}>
      <KeyboardAvoidingView
        behavior={keyboardBehaviorFor(Platform.OS)}
        keyboardVerticalOffset={keyboardVerticalOffsetFor({ insets, platform: Platform.OS })}
        style={styles.flex}
      >
        <View style={[styles.header, { backgroundColor: color.surface, borderBottomColor: color.border }]}>
          <Pressable
            accessibilityLabel="Tus preguntas"
            accessibilityRole="button"
            hitSlop={tokens.space.sm}
            onPress={() => setDrawerOpen(true)}
            style={({ pressed }) => [styles.round, { borderColor: color.border }, pressed && styles.pressed]}
            testID="qa-drawer-open"
          >
            <Icon color={color.ink} name="menu" size="sm" />
          </Pressable>
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.title, { color: color.ink }]}>
              {title}
            </Text>
            {quotaLabel ? <Text style={[styles.quota, { color: color.inkSoft }]}>{quotaLabel}</Text> : null}
          </View>
          <Pressable
            accessibilityLabel="Volver"
            accessibilityRole="button"
            hitSlop={tokens.space.sm}
            onPress={goBackOrHome}
            style={({ pressed }) => [styles.round, { borderColor: color.border }, pressed && styles.pressed]}
            testID="preguntar-chat-back"
          >
            <Icon color={color.ink} name="close" size="sm" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.thread}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // Con el teclado abierto, el primer tap sobre "Compartir" o un ejemplo
          // solo lo cerraría en vez de actuar.
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (messages.length > 0 || busy) threadRef.current?.scrollToEnd({ animated: true });
          }}
          ref={threadRef}
        >
          {messages.length === 0 && !busy && !threadLoading ? (
            <QaEmptyState disabled={atLimit} onAsk={onSend} passage={passage} />
          ) : null}
          {messages.map((message) => (
            <QaMessage key={message.key} message={message} referralCode={currentUser?.referralCode} />
          ))}
          {busy && pendingQuestion ? (
            <QaMessage
              message={{ key: "pending", role: "user", text: pendingQuestion, citation: null, question: null }}
            />
          ) : null}
          {busy ? (
            <LoadingState
              onRetry={() => {
                const last = lastQuestionRef.current;
                if (last) void sendQuestion(last);
              }}
              steps={QA_ANSWER_STEPS}
              testID="qa-loading"
              variant="inline"
            />
          ) : null}
        </ScrollView>

        <QaComposer
          atLimit={atLimit}
          autoFocus={!initial.conversationId}
          busy={busy}
          draft={draft}
          inputRef={inputRef}
          onChangeDraft={setDraft}
          onClearPassage={() => choosePassage(null)}
          onOpenPassage={() => setSheetOpen(true)}
          onSend={onSend}
          passage={passage}
          suggestions={composerSuggestions({ passage, hasAnswer })}
        />
      </KeyboardAvoidingView>

      <QaDrawer
        activeId={conversationId}
        conversations={conversations}
        onClose={() => setDrawerOpen(false)}
        onNew={newQuestion}
        onOpen={openConversation}
        visible={drawerOpen}
      />
      <PassageSheet
        onClose={() => setSheetOpen(false)}
        onSelect={choosePassage}
        version={version}
        visible={sheetOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  round: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  headerText: { alignItems: "center", flex: 1 },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  quota: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  thread: { gap: tokens.space.lg, padding: tokens.screenPadding.horizontal },
  pressed: { opacity: tokens.opacity.pressed },
});

/** Sin señal no puede responder: se avisa en vez de quedarse cargando (#160). */
export default function PreguntarScreen() {
  return (
    <RequiresConnection module="qa">
      <PreguntarScreenContent />
    </RequiresConnection>
  );
}
