import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../../components/Icon";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { goToPause } from "../../pause/goToPause";
import { PAUSE_LINK_CAPTION, PAUSE_LINK_LABEL } from "../homeCards";

/**
 * Entrada callada a "Un minuto de pausa" (#203) desde el inicio. No es una
 * tarjeta: una línea sin fondo ni borde, con el ícono del reloj en `inkSoft`,
 * el nombre en `sans` `bodySm` y la aclaración en `caption`. Sin versículo:
 * la pausa usa el del día.
 */
export function PauseLink() {
  const { color } = useTheme();

  const open = () => {
    track("home_card_opened");
    goToPause();
  };

  return (
    <Pressable
      accessibilityHint="Abre un minuto de silencio con el versículo del día."
      accessibilityLabel={PAUSE_LINK_LABEL}
      accessibilityRole="button"
      hitSlop={tokens.space.sm}
      onPress={open}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
      testID="home-pause-link"
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
  // Alineada con el contenido de las tarjetas: el `gap` del inicio ya la separa.
  root: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
  },
  text: { flex: 1, gap: tokens.space.xxs },
  label: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  caption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  pressed: { opacity: tokens.opacity.pressed },
});
