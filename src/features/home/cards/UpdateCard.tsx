import { StyleSheet, Text, View, Pressable } from "react-native";

import { Icon } from "../../../components/Icon";
import { withPressed } from "../../../theme/pressed";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";

/**
 * Aviso de versión nueva (antes arriba de todo en `home.tsx`). Un build viejo
 * de TestFlight se ve como "faltan opciones": es la tarjeta de contexto de
 * mayor prioridad (#232).
 */
export function UpdateCard({ onPress, storeName }: { onPress: () => void; storeName: string }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityHint={`Abre ${storeName}`}
      accessibilityRole="link"
      onPress={onPress}
      style={withPressed(styles.update, { backgroundColor: color.surfaceSunk, borderColor: color.borderStrong })}
      testID="home-update-available"
    >
      <Icon color={color.accent} name="refresh" size="md" />
      <View style={styles.text}>
        <Text style={[styles.title, { color: color.ink }]}>Hay una versión nueva</Text>
        <Text style={[styles.body, { color: color.inkMuted }]}>
          Tocá para actualizar en {storeName}. Sin actualizar te pueden faltar secciones.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  update: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  text: { flex: 1 },
  title: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
