import { Pressable, StyleSheet, Text, View, type AccessibilityRole } from "react-native";

import { withPressed } from "../theme/pressed";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";
import { Icon, type IconName } from "./Icon";

export type ChipSize = "sm" | "md" | "lg";

type ChipProps = {
  label?: string;
  icon?: IconName;
  /** Ícono en `accent` (p. ej. el chip de pasaje con un pasaje elegido). */
  iconActive?: boolean;
  onPress?: () => void;
  /** ✕ a la derecha para quitar (chip de pasaje de Preguntar y de Notas de prédica). */
  onClear?: () => void;
  clearLabel?: string;
  /** Elegido: fondo `ink`, texto `surface` (sentimientos de Sentir). */
  selected?: boolean;
  /** Ya usado: `surfaceSunk` y texto `inkFaint` (banco de palabras de Memorizar). */
  muted?: boolean;
  dashed?: boolean;
  /** Reparte el ancho entre los chips de una fila (inicio, U1b). */
  fill?: boolean;
  /**
   * `sm` — chips chicos de una lista (libros de la Línea del tiempo).
   * `md` — el chip de siempre (inicio, Sentir, Preguntar).
   * `lg` — palabras para tocar (Memorizar).
   */
  size?: ChipSize;
  /** Los pasajes van en serif, como en el lector. */
  serif?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  disabled?: boolean;
  testID?: string;
};

/**
 * Chip pill de toda la app (#232, Fase 4). Antes había 7 copias sueltas
 * (inicio, Leer, Línea del tiempo, Memorizar, Sentir ×2, Preguntar) con
 * paddings y bordes un poco distintos; los filtros de una sola elección siguen
 * en `FilterPills`.
 */
export function Chip({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  clearLabel,
  dashed = false,
  disabled = false,
  fill = false,
  icon,
  iconActive = false,
  label,
  muted = false,
  onClear,
  onPress,
  selected = false,
  serif = false,
  size = "md",
  testID,
}: ChipProps) {
  const { color } = useTheme();
  const background = selected ? color.ink : muted ? color.surfaceSunk : color.surface;
  const border = selected ? color.ink : muted ? color.border : color.borderStrong;
  const ink = selected ? color.surface : muted ? color.inkFaint : serif || size !== "md" ? color.ink : color.inkMuted;

  const content = (
    <>
      {icon ? <Icon color={iconActive ? color.accent : color.inkSoft} name={icon} size="sm" /> : null}
      {label ? (
        <Text numberOfLines={1} style={[styles.label, LABEL[size], serif && styles.serif, { color: ink }]}>
          {label}
        </Text>
      ) : null}
    </>
  );

  const chipStyle = [
    styles.chip,
    PADDING[size],
    { backgroundColor: background, borderColor: border },
    fill && styles.fill,
    dashed && styles.dashed,
  ];

  if (!onClear) {
    return (
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        disabled={disabled || !onPress}
        onPress={onPress}
        style={withPressed(chipStyle)}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[chipStyle, styles.withClear]}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole={accessibilityRole}
        disabled={disabled || !onPress}
        hitSlop={tokens.space.xs}
        onPress={onPress}
        style={withPressed(styles.inner)}
        testID={testID}
      >
        {content}
      </Pressable>
      <Pressable
        accessibilityLabel={clearLabel ?? `Quitar ${label ?? ""}`.trim()}
        accessibilityRole="button"
        hitSlop={tokens.space.sm}
        onPress={onClear}
        style={withPressed(styles.clear)}
        testID={testID ? `${testID}-clear` : undefined}
      >
        <Icon color={color.inkSoft} name="close" size="sm" />
      </Pressable>
    </View>
  );
}

const PADDING = StyleSheet.create({
  sm: { paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xxs },
  md: { paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  lg: { paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
});

const LABEL = StyleSheet.create({
  sm: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  md: { fontFamily: tokens.font.sans, fontSize: tokens.type.chip.size, lineHeight: tokens.type.caption.lineHeight },
  lg: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
  },
  withClear: { alignSelf: "flex-start" },
  inner: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs },
  clear: { marginLeft: tokens.space.xxs },
  fill: { flex: 1, justifyContent: "center", paddingHorizontal: tokens.space.xxs },
  dashed: { borderStyle: "dashed" },
  label: {},
  serif: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
});
