import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TABS, isConversationRoute, tabForRoute, tabHref, type ConversationRoute } from "../features/navigation/tabs";
import { withPressed } from "../theme/pressed";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";
import { Icon } from "./Icon";

/**
 * Barra de pestañas (#232, design/oleada-ux.md §Orden): `surface` con borde
 * arriba `border`, cinco pestañas con ícono `md` y nombre en `caption`. La
 * encendida va en `accent` (ícono) e `ink` (nombre); las demás en `inkSoft`.
 * Sin badges ni contadores: la barra solo orienta.
 */
export function TabBar({ insets, navigation, state }: BottomTabBarProps) {
  const { color } = useTheme();
  const current = state.routes[state.index]?.name ?? "home";
  const active = tabForRoute(current);
  const lastConversation = useRef<ConversationRoute | null>(null);
  if (isConversationRoute(current)) lastConversation.current = current;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: color.surface, borderTopColor: color.border, paddingBottom: Math.max(insets.bottom, tokens.space.sm) },
      ]}
      testID="tab-bar"
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        const target = tabHref(tab, lastConversation.current).slice(1);
        const routeName = target === "leer" ? "leer/index" : target;
        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.id}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: routeName, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigation.navigate(routeName);
            }}
            style={withPressed(styles.tab)}
            testID={`tab-${tab.id}`}
          >
            <Icon color={selected ? color.accent : color.inkSoft} name={tab.icon} size="md" />
            <Text numberOfLines={1} style={[selected ? styles.labelActive : styles.label, { color: selected ? color.ink : color.inkSoft }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, flexDirection: "row", paddingHorizontal: tokens.space.xs, paddingTop: tokens.space.sm },
  tab: { alignItems: "center", flex: 1, gap: tokens.space.xxs },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  labelActive: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
