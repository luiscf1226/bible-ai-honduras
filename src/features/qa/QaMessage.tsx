import { Pressable, StyleSheet, Text, View } from "react-native";

import { CitationLink } from "../../components/CitationLink";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { shareQaAnswer, type QaCitation } from "./shareAnswer";

export type QaThreadMessage = {
  key: string;
  role: "user" | "assistant";
  text: string;
  citation: QaCitation | null;
  /** Para compartir: la pregunta que respondió esta respuesta. */
  question: string | null;
};

type QaMessageProps = {
  message: QaThreadMessage;
  referralCode?: string;
};

/**
 * Burbuja de Preguntar: la del usuario en `ink` a la derecha; la respuesta en
 * `surface` con la cita tocable (`CitationLink`, #192), compartir y el aviso
 * de que la IA puede equivocarse.
 */
export function QaMessage({ message, referralCode }: QaMessageProps) {
  const { color } = useTheme();
  const isUser = message.role === "user";
  const canShare = !isUser && message.citation !== null && message.question !== null;

  return (
    <View style={[styles.wrap, isUser ? styles.wrapUser : styles.wrapAi]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: color.ink, borderColor: color.ink }
            : { backgroundColor: color.surface, borderColor: color.border },
        ]}
      >
        <Text style={isUser ? [styles.userText, { color: color.surface }] : [styles.aiText, { color: color.ink }]}>
          {message.text}
        </Text>
        {message.citation ? (
          <View style={[styles.citation, { backgroundColor: color.surfaceSunk }]}>
            <Text style={[styles.citationQuote, { color: color.inkMuted }]}>&ldquo;{message.citation.text}&rdquo;</Text>
            <CitationLink
              book={message.citation.book}
              chapter={message.citation.chapter}
              from="qa"
              testID="qa-citation"
              verse={message.citation.verse}
              version={message.citation.version}
            />
          </View>
        ) : null}
        {canShare ? (
          <View style={[styles.shareRow, { borderTopColor: color.border }]}>
            <Pressable
              accessibilityHint={referralCode ? "Abre las opciones para compartir esta respuesta." : "Esperá mientras cargamos tu perfil."}
              accessibilityRole="button"
              accessibilityState={{ disabled: !referralCode }}
              disabled={!referralCode}
              onPress={() => {
                if (!referralCode || !message.citation || !message.question) return;
                void shareQaAnswer({ question: message.question, citation: message.citation, referralCode });
              }}
              style={({ pressed }) => [styles.share, pressed && styles.pressed]}
              testID="qa-share-answer"
            >
              <Icon color={color.sage} name="share" size="sm" />
              <Text style={[styles.shareLabel, { color: color.inkMuted }]}>Compartir</Text>
            </Pressable>
            <Text style={[styles.disclaimer, { color: color.inkFaint }]}>La IA puede equivocarse</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row" },
  wrapUser: { justifyContent: "flex-end" },
  wrapAi: { justifyContent: "flex-start" },
  bubble: { borderRadius: tokens.radius.xl, borderWidth: 1, maxWidth: "88%", padding: tokens.space.lg },
  userText: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  aiText: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.aiBubble.size,
    lineHeight: tokens.type.aiBubble.lineHeight,
  },
  citation: { borderRadius: tokens.radius.md, marginTop: tokens.space.lg, padding: tokens.space.lg },
  citationQuote: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.body.size,
    fontStyle: "italic",
    lineHeight: tokens.type.body.lineHeight,
  },
  shareRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xl,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  share: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  shareLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.disclaimer.size },
  disclaimer: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.disclaimer.size },
  pressed: { opacity: tokens.opacity.pressed },
});
