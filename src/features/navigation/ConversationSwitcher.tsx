import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { withPressed } from "../../theme/pressed";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { CONVERSATION_OPTIONS, type ConversationRoute } from "./tabs";

/**
 * Selector de arriba de la pestaña Conversar (#232, design/oleada-ux.md
 * §Orden): Preguntar · Sentir · Personajes. Riel `surfaceSunk` pill y la
 * opción elegida en `surface` con borde `borderStrong`, como un chip apoyado.
 * Cada opción es una pantalla de `(tabs)`: cambiar no pierde lo escrito en la otra.
 */
/** `flush`: sin margen propio, para pantallas que ya tienen el padding (Personajes). */
export function ConversationSwitcher({ current, flush = false }: { current: ConversationRoute; flush?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[!flush && styles.wrap, { backgroundColor: color.surface }]}>
      <View accessibilityRole="tablist" style={[styles.rail, { backgroundColor: color.surfaceSunk }]} testID="conversar-selector">
        {CONVERSATION_OPTIONS.map((option) => {
          const active = option.id === current;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => {
                if (!active) router.navigate(`/${option.id}` as Href);
              }}
              style={withPressed(
                styles.segment,
                active ? { backgroundColor: color.surface, borderColor: color.borderStrong } : styles.segmentIdle,
              )}
              testID={`conversar-selector-${option.id}`}
            >
              <Text style={[active ? styles.labelActive : styles.label, { color: active ? color.ink : color.inkSoft }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: tokens.screenPadding.horizontal, paddingTop: tokens.space.sm },
  rail: { borderRadius: tokens.radius.pill, flexDirection: "row", padding: tokens.space.xxs },
  segment: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: tokens.space.xs,
  },
  segmentIdle: { backgroundColor: "transparent" },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.chip.size, lineHeight: tokens.type.caption.lineHeight },
  labelActive: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.chip.size, lineHeight: tokens.type.caption.lineHeight },
});
