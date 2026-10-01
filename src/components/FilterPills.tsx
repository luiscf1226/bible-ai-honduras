import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

export type FilterPillOption<T extends string> = {
  id: T;
  label: string;
  /** Punto de color antes del texto (filtro de Subrayados). Es un valor del tema, nunca un hex. */
  dot?: string;
};

type FilterPillsProps<T extends string> = {
  onSelect: (id: T) => void;
  options: readonly FilterPillOption<T>[];
  selected: T;
  style?: StyleProp<ViewStyle>;
  testID: string;
};

/**
 * Fila de filtros de una sola elección (Texto/Ilustradas y Antiguo/Nuevo en
 * Historias, Todos/Con nota en Guardados, colores en Subrayados). **Una sola
 * implementación**, como `SearchField`: regla dura #1, no se copia el patrón
 * con tokens distintos.
 */
export function FilterPills<T extends string>({ onSelect, options, selected, style, testID }: FilterPillsProps<T>) {
  const { color } = useTheme();

  return (
    <View style={[styles.row, style]} testID={testID}>
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[
              styles.pill,
              {
                backgroundColor: active ? color.surfaceSunk : color.surface,
                borderColor: active ? color.borderStrong : color.border,
              },
            ]}
            testID={`${testID}-${option.id}`}
          >
            {option.dot ? <View style={[styles.dot, { backgroundColor: option.dot }]} /> : null}
            <Text style={[styles.label, { color: active ? color.ink : color.inkSoft }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  pill: {
    alignItems: "center",
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    flexGrow: 1,
    gap: tokens.space.xs,
    justifyContent: "center",
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  // Mismo punto que la lista de Subrayados en Leer.
  dot: { borderRadius: tokens.radius.pill, height: tokens.size.dot, width: tokens.size.dot },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, textAlign: "center" },
});
