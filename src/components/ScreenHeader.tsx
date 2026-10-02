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
  /**
   * El ‹ va encima de una imagen (hero de `/hoy`): círculo con fondo
   * `surface` al 90 % para que se lea sobre cualquier foto (oleada UX §U2).
   */
  onImage?: boolean;
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
  onImage = false,
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
        // El círculo mide 34 (tokens.size.backButton) porque así está en el
        // prototipo, pero 34 queda por debajo del mínimo táctil de 44pt de iOS
        // y 48dp de Android. El hitSlop agranda el área sin tocar el diseño:
        // 34 + 9*2 = 52. Al estar acá, aplica a las 5 pantallas de una.
        hitSlop={tokens.space.sm}
        onPress={onBack}
        style={[styles.backButton, { borderColor: onImage ? "transparent" : color.border }, onImage && styles.onImage]}
        testID={testID}
      >
        {onImage ? <View style={[StyleSheet.absoluteFill, styles.onImageFill, { backgroundColor: color.surface }]} /> : null}
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
  onImage: { overflow: "hidden" },
  onImageFill: { opacity: tokens.opacity.imageButton },
  backIcon: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.subtitle.size,
  },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
  },
});
