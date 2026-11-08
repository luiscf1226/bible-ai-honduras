import type { ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

/**
 * Piezas que comparten "Dedicar" (#202) y "Crear imagen"
 * (design/oleada-ux.md §Crear imagen): el bloque con título en `overline`
 * (y contador opcional) y el lugar fuera de pantalla donde se dibuja la
 * imagen a tamaño de captura.
 */
export function ComposerField({ children, counter, label }: { children: ReactNode; counter?: string; label: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={[styles.overline, { color: color.accent }]}>{label}</Text>
        {counter ? <Text style={[styles.counter, { color: color.inkFaint }]}>{counter}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** La `VerseStoryCard` a tamaño de captura, fuera de pantalla y fuera del lector de pantalla. */
export function OffscreenCapture({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.offscreen, { left: -width * 2 }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: tokens.space.sm },
  fieldHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  counter: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  offscreen: { position: "absolute", top: 0 },
});
