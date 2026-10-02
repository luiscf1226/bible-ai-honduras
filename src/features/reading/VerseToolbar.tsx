import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { HIGHLIGHT_SWATCHES, type HighlightColor } from "./highlightColors";
import { visibleVerseActions, type VerseActionContext } from "./verseActions";

type VerseToolbarProps = {
  context: VerseActionContext;
  /** `undefined` = sin sesión: no se ofrece subrayar (igual que antes). */
  highlight?: { selected: HighlightColor | null; choose: (key: HighlightColor) => void; clear: () => void };
};

/**
 * Cuerpo de la hoja del versículo (#196, U4): fila de colores de subrayado y
 * cuadrícula de acciones con ícono y etiqueta. Las acciones salen del registro
 * `verseActions.ts`; acá solo se pintan.
 */
export function VerseToolbar({ context, highlight }: VerseToolbarProps) {
  const { color } = useTheme();
  const actions = visibleVerseActions(context);

  return (
    <View style={styles.container}>
      {highlight ? (
        <View accessibilityLabel="Subrayar" style={styles.swatches} testID="reading-highlight-picker">
          {HIGHLIGHT_SWATCHES.map((swatch) => {
            const active = highlight.selected === swatch.key;
            return (
              <Pressable
                accessibilityLabel={active ? `Quitar subrayado ${swatch.label}` : `Subrayar en ${swatch.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={tokens.space.xs}
                key={swatch.key}
                onPress={() => highlight.choose(swatch.key)}
                style={[styles.swatch, { backgroundColor: color[swatch.swatch] }]}
                testID={`reading-highlight-${swatch.key}`}
              >
                {active ? <Icon color={color.surface} name="check" size="sm" /> : null}
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel="Sin subrayado"
            accessibilityRole="button"
            accessibilityState={{ disabled: highlight.selected === null }}
            disabled={highlight.selected === null}
            hitSlop={tokens.space.xs}
            onPress={highlight.clear}
            style={[styles.swatch, styles.swatchNone, { borderColor: color.borderStrong }]}
            testID="reading-highlight-clear"
          >
            <Icon color={color.inkSoft} name="close" size="sm" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.grid} testID="reading-verse-toolbar">
        {actions.map((action) => {
          const active = action.active?.(context) ?? false;
          const disabled = action.disabled?.(context) ?? false;
          const label = action.label(context);
          return (
            <Pressable
              accessibilityHint={action.accessibilityHint?.(context)}
              accessibilityLabel={action.accessibilityLabel?.(context) ?? label}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: active }}
              disabled={disabled}
              key={action.id}
              onPress={() => action.onPress(context)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed, disabled && styles.disabled]}
              testID={action.testID}
            >
              <Icon
                color={active ? color.accent : color.ink}
                filled={active && action.fillWhenActive}
                name={action.icon}
                size="lg"
              />
              <Text numberOfLines={2} style={[styles.label, { color: active ? color.accent : color.inkMuted }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.md },
  swatches: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  swatch: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.icon.lg,
    justifyContent: "center",
    width: tokens.size.icon.lg,
  },
  swatchNone: { borderWidth: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: {
    alignItems: "center",
    gap: tokens.space.xs,
    justifyContent: "center",
    minHeight: tokens.size.actionTile,
    paddingVertical: tokens.space.xs,
    width: `${100 / tokens.grid.actionColumns}%`,
  },
  label: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  pressed: { opacity: tokens.opacity.pressed },
  disabled: { opacity: tokens.opacity.pressed },
});
