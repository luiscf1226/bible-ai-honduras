import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { withPressed } from "../theme/pressed";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";
import { Icon } from "./Icon";

type EntryCardProps = {
  overline: string;
  title: string;
  description?: string;
  /** Media tarjeta, de a dos por fila: título en `versePicker`. */
  half?: boolean;
  /** Marca a la izquierda del rótulo (la cinta del separador). */
  mark?: ReactNode;
  /** Chevron a la derecha: es una entrada a otra pantalla, no un atajo. */
  chevron?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * Tarjeta de entrada (#232, Fase 4): rótulo `overline` en `accent`, título
 * serif y una línea opcional. `surfaceAlt`, borde `border`, `radius.xl`. Antes
 * había 6 copias de `planCard` en `leer/index.tsx`; ahora la usan Leer
 * ("Seguí leyendo", "Planes y recorridos") y la pantalla de planes.
 */
export function EntryCard({
  accessibilityHint,
  chevron = false,
  description,
  half = false,
  mark,
  onPress,
  overline,
  testID,
  title,
}: EntryCardProps) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={`${overline}. ${title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={withPressed(styles.card, half && styles.half, { backgroundColor: color.surfaceAlt, borderColor: color.border })}
      testID={testID}
    >
      <View style={styles.text}>
        <View style={styles.overlineRow}>
          {mark}
          <Text style={[styles.overline, { color: color.accent }]}>{overline.toUpperCase()}</Text>
        </View>
        <Text style={[half ? styles.halfTitle : styles.title, { color: color.ink }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: color.inkMuted }]}>{description}</Text> : null}
      </View>
      {chevron ? <Icon color={color.inkFaint} name="chevronRight" size="sm" /> : null}
    </Pressable>
  );
}

/** Dos `EntryCard half` lado a lado. */
export function EntryCardRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  half: { flex: 1 },
  text: { flex: 1 },
  overlineRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight, marginTop: tokens.space.xs },
  halfTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight, marginTop: tokens.space.xs },
  description: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  row: { flexDirection: "row", gap: tokens.space.md },
});
