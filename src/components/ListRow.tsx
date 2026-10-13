import { Children, isValidElement, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { withPressed } from "../theme/pressed";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";
import { Icon } from "./Icon";

type ListCardProps = {
  children: ReactNode;
  /** `sunk` = bloque de aviso (privacidad de Mi espacio). */
  tone?: "surface" | "sunk";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Tarjeta de renglones (#232, Fase 4): `radius.xl`, borde `border` y una línea
 * entre renglón y renglón. Antes los estilos `card`/`row`/`rowDivider` estaban
 * copiados en 7 pantallas; ahora la línea la pone la tarjeta y cada pantalla
 * solo dice qué renglones lleva.
 */
export function ListCard({ children, style, testID, tone = "surface" }: ListCardProps) {
  const { color } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View
      style={[styles.card, { backgroundColor: tone === "sunk" ? color.surfaceSunk : color.surface, borderColor: color.border }, style]}
      testID={testID}
    >
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={index > 0 ? [styles.divider, { borderTopColor: color.border }] : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

/** Rótulo `overline` arriba de una `ListCard` (Ajustes, Mi espacio). */
export function ListSectionLabel({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>{children}</Text>;
}

type ListRowProps = {
  title: string;
  /** Una línea chica debajo del título (`caption`, `inkSoft`). */
  hint?: string;
  /** Lo último de una sección (una referencia o un título): serif `body`. */
  latest?: string;
  /** Número al lado del título (Mi espacio). `null` = cargando. */
  count?: number | null;
  /** Texto a la derecha con chevron ("Ver todo", "Empezar"). */
  action?: string;
  /** El `action` va apagado (sección vacía). */
  actionMuted?: boolean;
  /** Algo propio a la derecha (interruptor, ↗). Reemplaza al chevron. */
  trailing?: ReactNode;
  /** Contenido debajo del texto (selector de horas, de versión). */
  children?: ReactNode;
  tone?: "ink" | "danger" | "soft" | "accent";
  /** Título en serif: cuando el renglón es un pasaje ("Juan 3:16"). */
  serif?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "link";
  testID?: string;
};

/**
 * Renglón de lista (#232, Fase 4): título `label`, pista `caption` y, si se
 * puede tocar, un chevron (`Icon chevronRight`, nunca un "›" escrito).
 */
export function ListRow({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = "button",
  action,
  actionMuted = false,
  children,
  count,
  disabled = false,
  hint,
  latest,
  onPress,
  serif = false,
  testID,
  title,
  tone = "ink",
  trailing,
}: ListRowProps) {
  const { color } = useTheme();
  const titleColor = { ink: color.ink, danger: color.danger, soft: color.inkSoft, accent: color.accentDeep }[tone];

  const right =
    trailing !== undefined ? (
      trailing
    ) : onPress ? (
      <View style={styles.action}>
        {action ? <Text style={[styles.actionLabel, { color: actionMuted ? color.inkSoft : color.accentDeep }]}>{action}</Text> : null}
        <Icon color={action && !actionMuted ? color.accentDeep : color.inkFaint} name="chevronRight" size="sm" />
      </View>
    ) : null;

  const body = (
    <>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[serif ? styles.serifTitle : styles.title, { color: titleColor }]}>{title}</Text>
          {count !== undefined ? (
            <Text style={[styles.count, { color: count ? color.accent : color.inkFaint }]}>{count === null ? "…" : count}</Text>
          ) : null}
        </View>
        {latest ? (
          <Text numberOfLines={1} style={[styles.latest, { color: color.inkMuted }]}>
            {latest}
          </Text>
        ) : null}
        {hint ? <Text style={[styles.hint, { color: color.inkSoft }]}>{hint}</Text> : null}
        {children}
      </View>
      {right}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPress={onPress}
      style={withPressed(styles.row)}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  divider: { borderTopWidth: 1 },
  sectionLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    marginBottom: tokens.space.md,
    marginTop: tokens.space.xxl + tokens.space.xs,
    textTransform: "uppercase",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  text: { flex: 1, paddingRight: tokens.space.md },
  titleLine: { alignItems: "baseline", flexDirection: "row", gap: tokens.space.sm },
  title: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  serifTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.bodySm.lineHeight },
  count: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  latest: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  hint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  action: { alignItems: "center", flexDirection: "row", gap: tokens.space.xxs },
  actionLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
});
