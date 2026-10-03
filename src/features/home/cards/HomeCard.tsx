import { router, type Href } from "expo-router";
import type { PropsWithChildren } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../../components/Icon";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import type { HomeRoute } from "../homeCards";

/** Toda navegación desde una tarjeta del inicio pasa por acá: así queda en el embudo. */
export function openFromHome(route: HomeRoute) {
  track("home_card_opened");
  router.push(route as Href);
}

type HomeCardProps = PropsWithChildren<{
  icon: IconName;
  title: string;
  /** Una línea de qué ofrece el módulo. */
  caption?: string;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}>;

/**
 * Tarjeta base del inicio (design/oleada-ux.md §U1): `surface`, borde,
 * `radius.xxl`, fila de título con ícono y chevron, una línea de qué ofrece y
 * el contenido propio. Toda la tarjeta es tocable; lo de adentro puede tener
 * sus propios toques (chips, atajos).
 */
export function HomeCard({ accessibilityHint, caption, children, icon, onPress, testID, title }: HomeCardProps) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={title}
      // En web, role=button se vuelve <button> y los chips de adentro serían
      // botones anidados (HTML inválido). En iOS/Android no pasa.
      accessibilityRole={Platform.OS === "web" ? undefined : "button"}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.surface, borderColor: color.border },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.titleRow}>
        <Icon color={color.accent} name={icon} size="md" />
        <Text style={[styles.title, { color: color.ink }]}>{title}</Text>
        <Icon color={color.inkFaint} name="chevronRight" size="sm" />
      </View>
      {caption ? <Text style={[styles.caption, { color: color.inkMuted }]}>{caption}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  titleRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  caption: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xxs,
  },
  body: { gap: tokens.space.md, marginTop: tokens.space.md },
});

type HomeTileProps = PropsWithChildren<{
  icon: IconName;
  title: string;
  /** Rótulo `overline` `accent` arriba a la derecha (ej. "Del mes", #200). */
  badge?: string;
  onPress: () => void;
  accessibilityHint: string;
  testID: string;
}>;

/**
 * Mosaico de la cuadrícula 2×2 del inicio compacto (U1b): la misma piel que
 * `HomeCard` (`surface`, borde, `radius.xxl`, `cardPadding`), pero en columna
 * para que entre en media pantalla: ícono `md` `accent` y chevron arriba,
 * título serif `subtitle` y una sola pieza de contenido vivo abajo.
 */
export function HomeTile({ accessibilityHint, badge, children, icon, onPress, testID, title }: HomeTileProps) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={title}
      accessibilityRole={Platform.OS === "web" ? undefined : "button"}
      onPress={onPress}
      style={({ pressed }) => [
        tileStyles.tile,
        { backgroundColor: color.surface, borderColor: color.border },
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={tileStyles.top}>
        <Icon color={color.accent} name={icon} size="md" />
        {badge ? <Text style={[tileStyles.badge, { color: color.accent }]}>{badge}</Text> : null}
        <Icon color={color.inkFaint} name="chevronRight" size="sm" />
      </View>
      <Text numberOfLines={1} style={[tileStyles.title, { color: color.ink }]}>
        {title}
      </Text>
      {children}
    </Pressable>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  top: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs, justifyContent: "space-between" },
  badge: {
    flex: 1,
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textAlign: "right",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    marginBottom: tokens.space.xxs,
    marginTop: tokens.space.sm,
  },
});

/**
 * Chip pill con ícono: borde `borderStrong`, tipo `chip`, `inkSoft` (U1).
 * `fill` reparte el ancho entre los chips de una fila (U1b); sin `label` es un
 * chip de solo ícono y necesita `accessibilityLabel`.
 */
export function HomeChip({
  accessibilityHint,
  accessibilityLabel,
  dashed = false,
  fill = false,
  icon,
  label,
  onPress,
  testID,
}: {
  accessibilityHint: string;
  accessibilityLabel?: string;
  dashed?: boolean;
  fill?: boolean;
  icon?: IconName;
  label?: string;
  onPress: () => void;
  testID: string;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        { borderColor: color.borderStrong },
        fill && chipStyles.fill,
        dashed && chipStyles.dashed,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {icon ? <Icon color={color.inkSoft} name={icon} size="sm" /> : null}
      {label ? (
        <Text numberOfLines={1} style={[chipStyles.label, { color: color.inkSoft }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
  },
  fill: { flex: 1, justifyContent: "center", paddingHorizontal: tokens.space.xxs },
  dashed: { borderStyle: "dashed" },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.chip.size, lineHeight: tokens.type.chip.lineHeight },
});
