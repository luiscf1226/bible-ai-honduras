import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { tokens } from "../../theme/tokens";
import { FEED_MODE_TABS, type FeedMode } from "./feedLogic";

type FeedModeTabsProps = {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
};

/**
 * Pestañas de arriba del feed, como TikTok (design/oleada-ux.md §Feed en modo
 * TikTok): texto centrado flotando sobre la imagen, la activa en `surface`
 * con un subrayado corto y las demás atenuadas. Si con la letra del sistema
 * agrandada no entran, la fila se desliza y lleva la activa a la vista.
 */
export function FeedModeTabs({ mode, onChange }: FeedModeTabsProps) {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<FeedMode, number>());

  useEffect(() => {
    const x = offsets.current.get(mode);
    if (x !== undefined) scroll.current?.scrollTo({ animated: true, x: Math.max(0, x - tokens.size.feedAction) });
  }, [mode]);

  return (
    <ScrollView
      accessibilityRole="tablist"
      contentContainerStyle={styles.row}
      horizontal
      ref={scroll}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      testID="feed-modes"
    >
      {FEED_MODE_TABS.map((tab) => {
        const selected = tab.mode === mode;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={tokens.space.sm}
            key={tab.mode}
            onLayout={(event: LayoutChangeEvent) => offsets.current.set(tab.mode, event.nativeEvent.layout.x)}
            onPress={() => onChange(tab.mode)}
            style={styles.tab}
            testID={`feed-mode-${tab.mode}`}
          >
            <Text
              maxFontSizeMultiplier={tokens.fontScale.feedMax}
              style={[styles.label, { color: tokens.color.surface }, !selected && styles.idle]}
            >
              {tab.label}
            </Text>
            <View
              style={[styles.underline, { backgroundColor: selected ? tokens.color.surface : undefined }]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  row: { flexGrow: 1, gap: tokens.space.md, justifyContent: "center" },
  tab: { alignItems: "center", gap: tokens.space.xs },
  label: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  idle: { opacity: tokens.opacity.feedTabIdle },
  underline: {
    borderRadius: tokens.radius.pill,
    height: tokens.size.feedTabUnderline.height,
    width: tokens.size.feedTabUnderline.width,
  },
});
