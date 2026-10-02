import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { SideDrawer } from "../../components/SideDrawer";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

export type PastDevotional = { id: string; preview: string; createdAt: number };

type HistoryDrawerProps = {
  visible: boolean;
  items: readonly PastDevotional[];
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
};

function dayLabel(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString("es-HN", { day: "numeric", month: "long" });
}

/**
 * Cajón de Sentir (design/oleada-ux.md §U5): "Nuevo devocional" arriba, que
 * limpia el hilo, y "Los de antes" debajo.
 */
export function HistoryDrawer({ items, onClose, onNew, onOpen, visible }: HistoryDrawerProps) {
  const { color } = useTheme();
  return (
    <SideDrawer onClose={onClose} testID="sentir-history" title="Tus devocionales" visible={visible}>
      <Pressable
        accessibilityRole="button"
        onPress={onNew}
        style={({ pressed }) => [
          styles.newRow,
          { backgroundColor: color.surfaceSunk },
          pressed && styles.pressed,
        ]}
        testID="sentir-new"
      >
        <Icon color={color.accent} name="plus" size="md" />
        <Text style={[styles.newLabel, { color: color.ink }]}>Nuevo devocional</Text>
      </Pressable>

      <Text style={[styles.section, { color: color.inkSoft }]}>LOS DE ANTES</Text>
      {items.length === 0 ? (
        <Text style={[styles.emptyNote, { color: color.inkSoft }]}>
          Acá van a quedar tus devocionales. Solo los ves vos.
        </Text>
      ) : null}
      {items.map((item, index) => (
        <Pressable
          accessibilityHint="Abre este devocional anterior."
          accessibilityRole="button"
          key={item.id}
          onPress={() => onOpen(item.id)}
          style={({ pressed }) => [
            styles.item,
            index > 0 && { borderTopColor: color.border, borderTopWidth: 1 },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.itemCopy}>
            <Text numberOfLines={2} style={[styles.itemTitle, { color: color.ink }]}>
              {item.preview}
            </Text>
            <Text style={[styles.itemMeta, { color: color.inkSoft }]}>{dayLabel(item.createdAt)}</Text>
          </View>
          <Icon color={color.inkFaint} name="chevronRight" size="sm" />
        </Pressable>
      ))}
    </SideDrawer>
  );
}

const styles = StyleSheet.create({
  newRow: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  newLabel: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  section: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginTop: tokens.space.xl,
  },
  emptyNote: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  itemCopy: { flex: 1, gap: tokens.space.xxs },
  itemTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
  },
  itemMeta: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
