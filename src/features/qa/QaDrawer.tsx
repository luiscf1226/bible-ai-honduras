import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { SideDrawer } from "../../components/SideDrawer";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

export type QaConversationItem = {
  _id: string;
  title: string;
  lastQuestion: string | null;
};

type QaDrawerProps = {
  visible: boolean;
  conversations: readonly QaConversationItem[] | undefined;
  activeId?: string;
  onClose: () => void;
  onNew: () => void;
  onOpen: (conversationId: string) => void;
};

/**
 * Cajón de Preguntar (U6, #198): "Nueva pregunta" arriba y las conversaciones
 * de `qa.conversations` (#191) debajo. Mismo `SideDrawer` que Sentir (U5).
 * Fila: título en `label`, última pregunta en `caption` `inkSoft`, una línea.
 */
export function QaDrawer({ activeId, conversations, onClose, onNew, onOpen, visible }: QaDrawerProps) {
  const { color } = useTheme();

  return (
    <SideDrawer onClose={onClose} testID="qa-drawer" title="Tus preguntas" visible={visible}>
      <Pressable
        accessibilityRole="button"
        onPress={onNew}
        style={({ pressed }) => [styles.newRow, { borderBottomColor: color.border }, pressed && styles.pressed]}
        testID="qa-new-question"
      >
        <Icon color={color.accent} name="plus" size="md" />
        <Text style={[styles.newLabel, { color: color.ink }]}>Nueva pregunta</Text>
      </Pressable>

      {conversations && conversations.length === 0 ? (
        <Text style={[styles.empty, { color: color.inkSoft }]}>
          Acá van a quedar tus preguntas, una por tema.
        </Text>
      ) : null}

      {(conversations ?? []).map((conversation) => {
        const active = conversation._id === activeId;
        return (
          <Pressable
            accessibilityHint="Abre esta conversación."
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={conversation._id}
            onPress={() => onOpen(conversation._id)}
            style={({ pressed }) => [
              styles.row,
              active && { backgroundColor: color.surfaceSunk },
              pressed && styles.pressed,
            ]}
            testID={`qa-conversation-${conversation._id}`}
          >
            <View style={styles.rowText}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: color.ink }]}>
                {conversation.title}
              </Text>
              {conversation.lastQuestion ? (
                <Text numberOfLines={1} style={[styles.rowMeta, { color: color.inkSoft }]}>
                  {conversation.lastQuestion}
                </Text>
              ) : null}
            </View>
            <Icon color={color.inkFaint} name="chevronRight" size="sm" />
          </Pressable>
        );
      })}
    </SideDrawer>
  );
}

const styles = StyleSheet.create({
  newRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    marginBottom: tokens.space.xs,
    paddingBottom: tokens.space.lg,
    paddingTop: tokens.space.xs,
  },
  newLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.caption.lineHeight },
  empty: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingTop: tokens.space.xs,
  },
  row: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    flexDirection: "row",
    gap: tokens.space.md,
    marginHorizontal: -tokens.space.md,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  rowText: { flex: 1, gap: tokens.space.xxs },
  rowTitle: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.caption.lineHeight + tokens.space.xxs },
  rowMeta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  pressed: { opacity: tokens.opacity.pressed },
});
