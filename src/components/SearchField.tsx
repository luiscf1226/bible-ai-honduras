import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

/**
 * Barra de búsqueda de la app. **Una sola implementación** para todas las
 * superficies que buscan (Leer/Preguntar vía `PassageSearch`, Historias):
 * regla dura #1 — no se copia el patrón con tokens distintos.
 */

export type SearchFieldProps = {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  returnKeyType?: TextInputProps["returnKeyType"];
  style?: StyleProp<ViewStyle>;
  testID: string;
  value: string;
};

export function SearchField({
  accessibilityLabel,
  onChangeText,
  placeholder,
  returnKeyType,
  style,
  testID,
  value,
}: SearchFieldProps) {
  const { color } = useTheme();

  return (
    <View
      style={[styles.searchBar, { backgroundColor: color.surface, borderColor: color.borderStrong }, style]}
    >
      <Text style={[styles.searchIcon, { color: color.inkFaint }]}>⌕</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.inkFaint}
        returnKeyType={returnKeyType}
        style={[styles.searchInput, { color: color.ink }]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  searchIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  searchInput: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
});
