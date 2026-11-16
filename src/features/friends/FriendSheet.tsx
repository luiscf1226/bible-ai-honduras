import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon, type IconName } from "../../components/Icon";
import { withPressed } from "../../theme/pressed";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

export type SheetOption = {
  label: string;
  hint?: string;
  icon?: IconName;
  tone?: "ink" | "danger";
  onPress: () => void;
  testID: string;
};

/**
 * Hoja de opciones de Amigos (menú del chat, motivos de reporte,
 * confirmaciones). Misma hoja que el selector de pasajes de Preguntar
 * (`PassageSheet`): velo `ink`, esquinas de arriba `radius.xxl`. No usa
 * `Alert`: así se ve igual en iOS, Android y la web del QA.
 */
export function FriendSheet({
  body,
  onClose,
  options,
  testID,
  title,
  visible,
}: {
  visible: boolean;
  title: string;
  body?: string;
  options: readonly SheetOption[];
  onClose: () => void;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.scrim, { backgroundColor: color.ink }]}
        />
        <View style={[styles.sheet, { backgroundColor: color.surface }]} testID={testID}>
          <SafeAreaView edges={["bottom"]} style={styles.safe}>
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={[styles.title, { color: color.ink }]}>{title}</Text>
                {body ? <Text style={[styles.body, { color: color.inkMuted }]}>{body}</Text> : null}
              </View>
              <Pressable
                accessibilityLabel="Cerrar"
                accessibilityRole="button"
                hitSlop={tokens.space.sm}
                onPress={onClose}
                style={[styles.round, { borderColor: color.border }]}
                testID={`${testID}-close`}
              >
                <Icon color={color.ink} name="close" size="sm" />
              </Pressable>
            </View>
            <View style={[styles.options, { borderColor: color.border }]}>
              {options.map((option, index) => {
                const tint = option.tone === "danger" ? color.danger : color.ink;
                return (
                  <Pressable
                    accessibilityHint={option.hint}
                    accessibilityRole="button"
                    key={option.testID}
                    onPress={option.onPress}
                    style={withPressed([styles.option, index > 0 && { borderTopColor: color.border, borderTopWidth: 1 }])}
                    testID={option.testID}
                  >
                    {option.icon ? <Icon color={option.tone === "danger" ? color.danger : color.accent} name={option.icon} size="md" /> : null}
                    <View style={styles.optionText}>
                      <Text style={[styles.optionLabel, { color: tint }]}>{option.label}</Text>
                      {option.hint ? <Text style={[styles.optionHint, { color: color.inkSoft }]}>{option.hint}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, opacity: (1 - tokens.opacity.pressed) * 3 },
  sheet: {
    borderTopLeftRadius: tokens.radius.xxl,
    borderTopRightRadius: tokens.radius.xxl,
    overflow: "hidden",
    paddingHorizontal: tokens.screenPadding.horizontal,
    paddingTop: tokens.space.xl,
  },
  safe: { gap: tokens.space.lg, paddingBottom: tokens.space.lg },
  head: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.md },
  headText: { flex: 1, gap: tokens.space.xs },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.qaPickTitle.size, lineHeight: tokens.type.qaPickTitle.lineHeight },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  round: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  options: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  option: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  optionText: { flex: 1, gap: tokens.space.xxs },
  optionLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  optionHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
