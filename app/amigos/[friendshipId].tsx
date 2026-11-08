import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ThreadMessage } from "../../convex/friends";
import {
  MESSAGE_MAX_LENGTH,
  REPORT_REASONS,
  sendStatusCopy,
  THREAD_PAGE_SIZE,
  verseLabel,
  type ReportReason,
} from "../../convex/friendsCore";
import { AppButton } from "../../src/components/AppButton";
import { Icon } from "../../src/components/Icon";
import { HeaderIconButton, ScreenHeader, goBackOrHome } from "../../src/components/ScreenHeader";
import { buildChatItems } from "../../src/features/friends/chatLogic";
import { CommunityRules } from "../../src/features/friends/CommunityRules";
import { FriendAvatar } from "../../src/features/friends/FriendAvatar";
import { FriendSheet, type SheetOption } from "../../src/features/friends/FriendSheet";
import { useScreenInsets, useScrollToEndOnKeyboard } from "../../src/hooks/useKeyboardAvoidance";
import { copyToClipboard } from "../../src/lib/clipboard";
import { keyboardBehaviorFor, keyboardVerticalOffsetFor } from "../../src/lib/keyboardAvoidance";
import { openPassage } from "../../src/lib/openPassage";
import { withPressed } from "../../src/theme/pressed";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/** Qué hoja está abierta: el menú, los motivos de reporte, o una confirmación. */
type Sheet =
  | { kind: "menu" }
  | { kind: "message"; message: ThreadMessage }
  | { kind: "reasons"; messageId?: Id<"directMessages"> }
  | { kind: "reportBlock"; reason: ReportReason; messageId?: Id<"directMessages"> }
  | { kind: "block" }
  | { kind: "remove" }
  | null;

/**
 * Chat 1 a 1 con un amigo (1.0.3, design/oleada-ux.md §Amigos y chat).
 * Burbujas como las de Voces, tarjeta propia para los versículos, menú con
 * Reportar y Bloquear, y toque largo sobre un mensaje para reportarlo. Los
 * mensajes llegan de a páginas; "Ver mensajes anteriores" trae más arriba.
 */
export default function FriendChatScreen() {
  const { color } = useTheme();
  const insets = useScreenInsets();
  const threadRef = useRef<ScrollView>(null);
  useScrollToEndOnKeyboard(threadRef);
  const params = useLocalSearchParams<{ friendshipId: string }>();
  const friendshipId = params.friendshipId as Id<"friendships">;
  const thread = useQuery(api.friends.thread, friendshipId ? { friendshipId } : "skip");
  // Del más nuevo al más viejo; se dan vuelta para dibujar.
  const history = usePaginatedQuery(api.friends.messages, friendshipId ? { friendshipId } : "skip", {
    initialNumItems: THREAD_PAGE_SIZE,
  });
  const focused = useIsFocused();
  const sendText = useMutation(api.friends.sendText);
  const markRead = useMutation(api.friends.markRead);
  const accept = useMutation(api.friends.accept);
  const remove = useMutation(api.friends.remove);
  const block = useMutation(api.friends.block);
  const report = useMutation(api.friends.report);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // `info` = confirmación (reporte enviado); `error` = lo que no se pudo hacer.
  const [notice, setNoticeState] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const setNotice = (text: string | null, tone: "info" | "error" = "error") => setNoticeState(text ? { text, tone } : null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const messages = useMemo(() => [...history.results].reverse(), [history.results]);
  const lastMessageId = history.results[0]?.id;
  // Al traer mensajes anteriores no se baja al final; un mensaje nuevo sí baja.
  const keepPosition = useRef(false);

  // Con el chat en pantalla, leído hasta el último mensaje que se ve.
  useEffect(() => {
    keepPosition.current = false;
    if (!focused || thread?.status !== "accepted" || !lastMessageId) return;
    void markRead({ friendshipId, upTo: lastMessageId }).catch(() => undefined);
  }, [focused, friendshipId, lastMessageId, markRead, thread?.status]);

  const items = useMemo(() => buildChatItems(messages, thread?.friendReadAt ?? null), [messages, thread?.friendReadAt]);

  if (thread === undefined) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]}>
        <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} style={styles.loneHeader} />
      </SafeAreaView>
    );
  }

  if (thread === null) {
    return (
      <SafeAreaView style={[styles.safe, styles.gone, { backgroundColor: color.surface }]}>
        <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Chat" />
        <Text style={[styles.body, { color: color.inkMuted }]} testID="amigos-chat-no-disponible">
          Este chat ya no está disponible.
        </Text>
        <AppButton onPress={() => router.replace("/amigos")} variant="secondary">
          Ir a Amigos
        </AppButton>
      </SafeAreaView>
    );
  }

  const name = thread.friend.name;
  const closeSheet = () => setSheet(null);

  const onSend = async () => {
    if (busy || draft.trim().length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await sendText({ friendshipId, text: draft });
      if (result.status === "ok") setDraft("");
      else setNotice(sendStatusCopy(result.status));
    } catch {
      setNotice("No se pudo enviar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: () => Promise<unknown>, after?: () => void) => {
    closeSheet();
    try {
      await action();
      after?.();
    } catch {
      setNotice("No se pudo hacer. Revisá tu conexión e intentá de nuevo.");
    }
  };

  const sendReport = async (reason: ReportReason, messageId: Id<"directMessages"> | undefined, alsoBlock: boolean) => {
    closeSheet();
    try {
      const result = await report({ friendshipId, reason, alsoBlock, ...(messageId ? { messageId } : {}) });
      if (result.status === "too_many") setNotice("Ya hiciste muchos reportes hoy. Si es urgente, bloqueá a la persona desde el menú.");
      else if (result.status !== "ok") setNotice("Ese mensaje ya no está.");
      else if (alsoBlock) router.replace("/amigos");
      else setNotice("Gracias. Revisamos cada reporte en menos de 24 horas.", "info");
    } catch {
      setNotice("No se pudo enviar el reporte. Revisá tu conexión e intentá de nuevo.");
    }
  };

  // Se reporta desde una amistad o una solicitud que te mandaron, no desde la que mandaste.
  const canReport = thread.status === "accepted" || !thread.requestedByMe;
  const menuOptions: SheetOption[] = [
    ...(canReport
      ? [
          {
            label: `Reportar a ${name}`,
            hint: "Nos llega una copia de sus últimos mensajes para revisarla.",
            icon: "flag" as const,
            onPress: () => setSheet({ kind: "reasons" }),
            testID: "amigos-chat-menu-reportar",
          },
        ]
      : []),
    {
      label: `Bloquear a ${name}`,
      hint: "No te va a poder escribir ni volver a agregarte.",
      icon: "block",
      tone: "danger",
      onPress: () => setSheet({ kind: "block" }),
      testID: "amigos-chat-menu-bloquear",
    },
    {
      label: thread.status === "accepted" ? "Dejar de ser amigos" : "Cancelar la solicitud",
      icon: "close",
      onPress: () => setSheet({ kind: "remove" }),
      testID: "amigos-chat-menu-quitar",
    },
  ];

  const sheetProps = (() => {
    if (!sheet) return null;
    switch (sheet.kind) {
      case "menu":
        return { title: name, options: menuOptions, testID: "amigos-chat-menu" };
      case "message": {
        const options: SheetOption[] = [
          {
            label: "Copiar",
            icon: "copy",
            onPress: () => {
              closeSheet();
              void copyToClipboard(sheet.message.verse ? `${sheet.message.verse.text} (${verseLabel(sheet.message.verse)})` : (sheet.message.text ?? ""));
            },
            testID: "amigos-mensaje-copiar",
          },
        ];
        if (!sheet.message.fromMe) {
          options.push({
            label: "Reportar este mensaje",
            icon: "flag",
            tone: "danger",
            onPress: () => setSheet({ kind: "reasons", messageId: sheet.message.id }),
            testID: "amigos-mensaje-reportar",
          });
        }
        return { title: "Mensaje", options, testID: "amigos-mensaje-menu" };
      }
      case "reasons":
        return {
          title: sheet.messageId ? "¿Qué tiene este mensaje?" : `¿Por qué reportás a ${name}?`,
          body: "Elegí una opción. No le avisamos que lo reportaste.",
          options: REPORT_REASONS.map((reason) => ({
            label: reason.label,
            onPress: () => setSheet({ kind: "reportBlock", reason: reason.id, messageId: sheet.messageId }),
            testID: `amigos-reporte-${reason.id}`,
          })),
          testID: "amigos-reporte-motivos",
        };
      case "reportBlock":
        return {
          title: `¿También querés bloquear a ${name}?`,
          body: "Si lo bloqueás, se borra la conversación y no te va a poder escribir. El reporte nos llega igual.",
          options: [
            {
              label: "Reportar y bloquear",
              icon: "block" as const,
              tone: "danger" as const,
              onPress: () => void sendReport(sheet.reason, sheet.messageId, true),
              testID: "amigos-reporte-bloquear",
            },
            {
              label: "Solo reportar",
              icon: "flag" as const,
              onPress: () => void sendReport(sheet.reason, sheet.messageId, false),
              testID: "amigos-reporte-enviar",
            },
          ],
          testID: "amigos-reporte-confirmar",
        };
      case "block":
        return {
          title: `¿Bloquear a ${name}?`,
          body: "Se borra la conversación para los dos y no te va a poder escribir ni volver a agregarte. No le avisamos. Lo podés desbloquear desde Amigos.",
          options: [
            {
              label: "Bloquear",
              icon: "block" as const,
              tone: "danger" as const,
              onPress: () => void act(() => block({ friendshipId }), () => router.replace("/amigos")),
              testID: "amigos-bloquear-confirmar",
            },
          ],
          testID: "amigos-bloquear",
        };
      case "remove":
        return {
          title: thread.status === "accepted" ? "¿Dejar de ser amigos?" : "¿Cancelar la solicitud?",
          body: "Se borra la conversación para los dos.",
          options: [
            {
              label: thread.status === "accepted" ? "Dejar de ser amigos" : "Cancelar la solicitud",
              tone: "danger" as const,
              onPress: () => void act(() => remove({ friendshipId }), () => router.replace("/amigos")),
              testID: "amigos-quitar-confirmar",
            },
          ],
          testID: "amigos-quitar",
        };
    }
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: color.surface }]}>
      <KeyboardAvoidingView
        behavior={keyboardBehaviorFor(Platform.OS)}
        keyboardVerticalOffset={keyboardVerticalOffsetFor({ insets, platform: Platform.OS })}
        style={styles.flex}
      >
        <View style={[styles.header, { borderBottomColor: color.border }]}>
          <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} testID="amigos-chat-volver" />
          <FriendAvatar initial={thread.friend.initial} size="header" />
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: color.ink }]}>{name}</Text>
            <Text style={[styles.tag, { color: color.inkSoft }]}>{thread.status === "accepted" ? "Amigo en 3C" : "Solicitud de amistad"}</Text>
          </View>
          <HeaderIconButton accessibilityLabel="Más opciones" onPress={() => setSheet({ kind: "menu" })} testID="amigos-chat-menu-abrir">
            <Icon color={color.inkMuted} name="more" size="md" />
          </HeaderIconButton>
        </View>

        {thread.gate === "rules_required" ? (
          <ScrollView contentContainerStyle={styles.rules}>
            <CommunityRules />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.thread}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onContentSizeChange={() => {
              if (!keepPosition.current) threadRef.current?.scrollToEnd({ animated: false });
            }}
            ref={threadRef}
            testID="amigos-chat-hilo"
          >
            {history.status === "CanLoadMore" || history.status === "LoadingMore" ? (
              <AppButton
                disabled={history.status === "LoadingMore"}
                onPress={() => {
                  keepPosition.current = true;
                  history.loadMore(THREAD_PAGE_SIZE);
                }}
                testID="amigos-chat-anteriores"
                variant="quiet"
              >
                {history.status === "LoadingMore" ? "Cargando…" : "Ver mensajes anteriores"}
              </AppButton>
            ) : null}
            {thread.status === "pending" ? (
              <View style={[styles.pending, { backgroundColor: color.surfaceSunk, borderColor: color.border }]}>
                <Text style={[styles.bodySm, { color: color.inkMuted }]}>
                  {thread.requestedByMe
                    ? `Le mandaste una solicitud a ${name}. Cuando la acepte, van a poder escribirse.`
                    : `${name} quiere ser tu amigo en 3C.`}
                </Text>
                {thread.requestedByMe ? null : (
                  <AppButton onPress={() => void act(() => accept({ friendshipId }))} testID="amigos-chat-aceptar">
                    Aceptar
                  </AppButton>
                )}
              </View>
            ) : items.length === 0 && history.status !== "LoadingFirstPage" ? (
              <Text style={[styles.empty, { color: color.inkSoft }]}>
                Escribile a {name} o mandale un versículo desde la Biblia: tocá un versículo y elegí «Enviar a un amigo».
              </Text>
            ) : null}

            {items.map((item) =>
              item.kind === "day" ? (
                <Text key={item.key} style={[styles.day, { color: color.inkSoft }]}>
                  {item.label}
                </Text>
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  onLongPress={() => setSheet({ kind: "message", message: item.message })}
                  seen={item.seen}
                  time={item.time}
                />
              ),
            )}
          </ScrollView>
        )}

        {thread.gate === "rules_required" ? null : (
          <View style={[styles.composer, { borderTopColor: color.border }]}>
            {notice ? (
              <Text
                accessibilityRole="alert"
                style={[styles.notice, { color: notice.tone === "error" ? color.danger : color.inkMuted }]}
                testID="amigos-chat-aviso"
              >
                {notice.text}
              </Text>
            ) : null}
            {thread.canWrite ? (
              <View style={[styles.inputRow, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
                <TextInput
                  accessibilityLabel={`Mensaje para ${name}`}
                  maxLength={MESSAGE_MAX_LENGTH}
                  multiline
                  onChangeText={setDraft}
                  placeholder="Escribí un mensaje…"
                  placeholderTextColor={color.inkFaint}
                  style={[styles.input, { color: color.ink }]}
                  testID="amigos-chat-input"
                  value={draft}
                />
                <Pressable
                  accessibilityLabel="Enviar"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || draft.trim().length === 0 }}
                  disabled={busy || draft.trim().length === 0}
                  onPress={() => void onSend()}
                  style={withPressed(styles.send, {
                    backgroundColor: draft.trim().length === 0 ? color.inkFaint : color.ink,
                  })}
                  testID="amigos-chat-enviar"
                >
                  <Icon color={color.surface} name="send" size="sm" />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.bodySm, { color: color.inkSoft }]}>
                {thread.gate === "suspended"
                  ? sendStatusCopy("suspended")
                  : thread.requestedByMe
                    ? "Cuando acepte la solicitud, van a poder escribirse."
                    : "Aceptá la solicitud para escribirse. Si no conocés a esta persona, podés bloquearla desde el menú."}
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {sheetProps ? <FriendSheet onClose={closeSheet} visible {...sheetProps} /> : null}
    </SafeAreaView>
  );
}

function MessageBubble({
  message,
  onLongPress,
  seen,
  time,
}: {
  message: ThreadMessage;
  onLongPress: () => void;
  seen: boolean;
  time: string;
}) {
  const { color } = useTheme();
  const mine = message.fromMe;
  const verse = message.kind === "verse" ? message.verse : undefined;

  return (
    <View style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
      <Pressable
        accessibilityHint="Mantené presionado para copiar o reportar."
        delayLongPress={350}
        onLongPress={onLongPress}
        style={[
          styles.bubble,
          verse
            ? { backgroundColor: color.paper, borderColor: color.border }
            : mine
              ? { backgroundColor: color.ink, borderColor: color.ink }
              : { backgroundColor: color.surface, borderColor: color.border },
        ]}
        testID={verse ? "amigos-mensaje-versiculo" : "amigos-mensaje"}
      >
        {verse ? (
          <View style={styles.verse}>
            <Text style={[styles.overline, { color: color.accent }]}>VERSÍCULO</Text>
            <Text style={[styles.verseText, { color: color.ink }]}>“{verse.text}”</Text>
            <View style={styles.verseFoot}>
              <Text style={[styles.verseRef, { color: color.inkMuted }]}>
                {verseLabel(verse)} ({verse.version})
              </Text>
              <Pressable
                accessibilityHint="Abre el capítulo en la Biblia."
                accessibilityRole="button"
                hitSlop={tokens.space.sm}
                onPress={() => openPassage({ book: verse.book, chapter: verse.chapter, verse: verse.verse })}
                style={withPressed(styles.read, { borderColor: color.borderStrong })}
                testID="amigos-mensaje-leer"
              >
                <Icon color={color.accentDeep} name="book" size="sm" />
                <Text style={[styles.readLabel, { color: color.accentDeep }]}>Leer</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text selectable style={[styles.bubbleText, { color: mine ? color.surface : color.ink }]}>
            {message.text}
          </Text>
        )}
      </Pressable>
      <Text style={[styles.time, { color: color.inkFaint }]}>
        {time}
        {seen ? " · Visto" : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  loneHeader: { paddingHorizontal: tokens.cardPadding.horizontal },
  gone: { gap: tokens.space.lg, paddingHorizontal: tokens.screenPadding.horizontal },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  bodySm: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  headerText: { flex: 1 },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.bodySm.lineHeight },
  tag: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  rules: { padding: tokens.screenPadding.horizontal },
  thread: { gap: tokens.space.md, padding: tokens.cardPadding.horizontal },
  pending: { borderRadius: tokens.radius.xl, borderWidth: 1, gap: tokens.space.md, padding: tokens.space.lg },
  empty: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingVertical: tokens.space.xl,
    textAlign: "center",
  },
  day: {
    alignSelf: "center",
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.caption.lineHeight,
    paddingVertical: tokens.space.xs,
    textTransform: "uppercase",
  },
  bubbleWrap: { gap: tokens.space.xxs, maxWidth: "84%" },
  wrapMine: { alignItems: "flex-end", alignSelf: "flex-end" },
  wrapTheirs: { alignItems: "flex-start", alignSelf: "flex-start" },
  bubble: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  bubbleText: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  time: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  verse: { gap: tokens.space.sm },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  verseText: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  verseFoot: { alignItems: "center", flexDirection: "row", gap: tokens.space.md, justifyContent: "space-between" },
  verseRef: { flexShrink: 1, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  read: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.xs,
  },
  readLabel: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  composer: { borderTopWidth: 1, gap: tokens.space.sm, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  notice: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  inputRow: {
    alignItems: "flex-end",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  input: {
    flex: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    maxHeight: tokens.size.composerMax,
    paddingVertical: tokens.space.xxs,
  },
  send: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.sendButton,
    justifyContent: "center",
    width: tokens.size.sendButton,
  },
});
