import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { Icon } from "../../../components/Icon";
import { openPassage } from "../../../lib/openPassage";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { HOME_ROUTES, readStatusLine } from "../homeCards";
import { HomeTile, openFromHome } from "./HomeCard";

/**
 * Mosaico Leer la Biblia (U1b): el mosaico abre la Biblia y la línea de
 * estado (separador / seguí leyendo / Génesis 1) abre ese pasaje. Subrayados,
 * Guardados, Notas y Planes viven en la pantalla de Leer.
 */
export function ReadCard() {
  const { color } = useTheme();
  const separator = useQuery(api.reading.separator);
  const progress = useQuery(api.reading.progress);
  const status = readStatusLine(separator, progress);

  return (
    <HomeTile
      accessibilityHint="Abre la Biblia completa."
      icon="book"
      onPress={() => openFromHome(HOME_ROUTES.read)}
      testID="home-card-read"
      title="Leer la Biblia"
    >
      <Pressable
        accessibilityHint={`Abre ${status.passage.book} ${status.passage.chapter}.`}
        accessibilityRole="button"
        hitSlop={tokens.space.xs}
        onPress={() => {
          track("home_card_opened");
          openPassage(status.passage);
        }}
        style={({ pressed }) => [styles.status, pressed && styles.pressed]}
        testID="home-read-status"
      >
        <Icon color={color.accent} name="ribbon" size="sm" />
        <Text numberOfLines={2} style={[styles.statusLabel, { color: color.inkMuted }]}>
          {status.label}
        </Text>
      </Pressable>
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  status: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.xs },
  statusLabel: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
