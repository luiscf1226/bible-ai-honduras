import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { withPressed } from "../../theme/pressed";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { goToPause } from "./goToPause";

export const PAUSE_LINK_LABEL = "Un minuto de pausa";
export const PAUSE_LINK_CAPTION = "Sin leer ni escribir: un versículo y silencio";

/**
 * Entrada callada a "Un minuto de pausa" (#203). No es una tarjeta: una línea
 * sin fondo ni borde, con el ícono del reloj en `inkSoft`, el nombre en `sans`
 * `bodySm` y la aclaración en `caption`. Sin versículo: la pausa usa el del día.
 *
 * Desde #232 vive en Sentir (la vista vacía), no en el inicio: es para quien
 * llega cansado y no quiere escribir, y ahí es donde llega.
 */
export function PauseLink() {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityHint="Abre un minuto de silencio con el versículo del día."
      accessibilityLabel={PAUSE_LINK_LABEL}
      accessibilityRole="button"
      hitSlop={tokens.space.sm}
      onPress={() => goToPause()}
      style={withPressed(styles.root)}
      testID="sentir-pause-link"
    >
      <Icon color={color.inkSoft} name="clock" size="sm" />
      <View style={styles.text}>
        <Text style={[styles.label, { color: color.inkMuted }]}>{PAUSE_LINK_LABEL}</Text>
        <Text style={[styles.caption, { color: color.inkSoft }]}>{PAUSE_LINK_CAPTION}</Text>
      </View>
      <Icon color={color.inkFaint} name="chevronRight" size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
  },
  text: { flex: 1, gap: tokens.space.xxs },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  caption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
