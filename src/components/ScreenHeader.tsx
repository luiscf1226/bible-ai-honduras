import { router } from "expo-router";
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle, View } from "react-native";

import { goBackOrHomeWith, type BackNavigator } from "../lib/navigation";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

export type ScreenHeaderProps = {
  /** Título opcional a la derecha del ‹ (diseño: Ajustes, Historial, picker de Preguntar). */
  title?: string;
  /**
   * `page` — título grande de pantalla (Ajustes, Historial).
   * `pick` — título compacto del picker (Preguntar: libro / capítulo).
   */
  titleSize?: "page" | "pick";
  titleStyle?: StyleProp<TextStyle>;
  onBack?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Desapila si hay historial; si no, aterriza en Home (arranque en frío / deep link). */
export function goBackOrHome() {
  goBackOrHomeWith(router as unknown as BackNavigator);
}

/**
 * Chrome compartido de pantalla: ‹ circular (`tokens.size.backButton`, 34px del
 * prototipo) más título opcional. Único dueño del estilo del botón de volver;
 * ninguna pantalla debe redefinirlo (issue #106).
 */
export function ScreenHeader({
  title,
  titleSize = "page",
  titleStyle,
  onBack = goBackOrHome,
  accessibilityLabel = "Volver",
  testID,
  style,
}: ScreenHeaderProps) {
  const { color } = useTheme();
  const titleType = titleSize === "pick" ? tokens.type.qaPickTitle : tokens.type.title;

  return (
    <View style={[styles.header, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onBack}
        style={[styles.backButton, { borderColor: color.border }]}
        testID={testID}
      >
        <Text style={[styles.backIcon, { color: color.ink }]}>‹</Text>
      </Pressable>
      {title ? (
        <Text
          style={[
            styles.title,
            { color: color.ink, fontSize: titleType.size, lineHeight: titleType.lineHeight },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
  },
  backButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  backIcon: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.subtitle.size,
  },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
  },
});
