import { StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { feelingsLabel, type UserTurn } from "./thread";

/** Vista vacía, centrada en el espacio libre (sin el hueco de antes, #197). */
export function EmptyThread() {
  const { color } = useTheme();
  return (
    <View style={styles.empty} testID="sentir-empty">
      <Icon color={color.accent} name="sunrise" size="lg" />
      <Text style={[styles.emptyTitle, { color: color.ink }]}>¿Qué llevás encima hoy?</Text>
      <Text style={[styles.emptyNote, { color: color.inkSoft }]}>
        Elegí lo que más se parezca o contalo con tus palabras. Queda solo entre vos y la app.
      </Text>
      <Text style={[styles.emptyNote, { color: color.inkFaint }]}>
        Acompañamiento, no consejo pastoral ni atención en crisis.
      </Text>
    </View>
  );
}

/** Lo que mandó la persona: los chips como texto y, debajo, sus palabras. */
export function UserBubble({ turn }: { turn: UserTurn }) {
  const { color } = useTheme();
  return (
    <View style={styles.userRow}>
      <View style={[styles.bubble, { backgroundColor: color.ink }]} testID="sentir-user-message">
        {turn.feelings.length > 0 ? (
          <Text style={[styles.bubbleFeelings, { color: color.surface }]}>{feelingsLabel(turn.feelings)}</Text>
        ) : null}
        {turn.note ? <Text style={[styles.bubbleNote, { color: color.surface }]}>{turn.note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    flex: 1,
    gap: tokens.space.md,
    justifyContent: "center",
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    textAlign: "center",
  },
  emptyNote: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  bubble: {
    borderRadius: tokens.radius.xl,
    gap: tokens.space.xxs,
    maxWidth: "88%",
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  bubbleFeelings: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  bubbleNote: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
});
