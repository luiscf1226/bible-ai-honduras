import type { FunctionReturnType } from "convex/server";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { openPassage } from "../../lib/openPassage";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { HIGHLIGHT_SWATCHES, highlightFill, highlightSwatch } from "./highlightColors";

export type HighlightedVerse = FunctionReturnType<typeof api.reading.highlightsWithText>["items"][number];

/**
 * Un versículo subrayado en la pantalla Subrayados. Es la tarjeta de
 * `SavedVerseCard` (etiqueta, versículo en serif, referencia abajo) con el
 * punto y el fondo del color del subrayado, igual que en el lector. Tocarla
 * abre el versículo; ahí se cambia o se quita el color.
 */
export function HighlightCard({ item }: { item: HighlightedVerse }) {
  const { color } = useTheme();
  const label = HIGHLIGHT_SWATCHES.find((swatch) => swatch.key === item.color)?.label ?? "";
  const reference = `${item.book} ${item.chapter}:${item.verse}`;

  return (
    <Pressable
      accessibilityHint="Abre el versículo en el lector."
      accessibilityLabel={`${reference}, subrayado en ${label}`}
      accessibilityRole="button"
      onPress={() => openPassage(item)}
      style={({ pressed }) => [styles.card, { backgroundColor: color.surface, borderColor: color.border }, pressed && styles.pressed]}
      testID="highlight-card"
    >
      <View style={styles.kindRow}>
        <View style={[styles.dot, { backgroundColor: highlightSwatch(color, item.color) }]} />
        <Text style={[styles.kind, { color: color.inkSoft }]}>{label}</Text>
      </View>
      {item.text !== null ? (
        <Text numberOfLines={3} style={[styles.text, { color: color.ink }]}>
          <Text style={{ backgroundColor: highlightFill(color, item.color) }}>“{item.text}”</Text>
        </Text>
      ) : (
        <Text style={[styles.missing, { color: color.inkSoft }]}>
          Este versículo todavía no está en {item.version}. Tocá para abrir el capítulo.
        </Text>
      )}
      <View style={[styles.footer, { borderTopColor: color.border }]}>
        <Text numberOfLines={1} style={[styles.meta, { color: color.inkSoft }]}>
          {reference}
        </Text>
      </View>
    </Pressable>
  );
}

// Mismos valores que `SavedVerseCard.tsx`.
const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, padding: tokens.space.xl },
  pressed: { opacity: tokens.opacity.pressed },
  kindRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm },
  dot: { borderRadius: tokens.radius.pill, height: tokens.size.dot, width: tokens.size.dot },
  kind: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  text: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
    marginTop: tokens.space.md,
  },
  missing: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.md,
  },
  footer: { borderTopWidth: 1, marginTop: tokens.space.lg, paddingTop: tokens.space.md },
  meta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
});
