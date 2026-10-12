import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { Icon } from "../../../components/Icon";
import { openPassage } from "../../../lib/openPassage";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { readStatusLine } from "../homeCards";
import { HomeTile } from "./HomeCard";

/**
 * Mosaico Leer la Biblia (U1b). Desde #232 tiene **un solo destino**: el
 * pasaje de la línea de estado (separador / seguí leyendo / Génesis 1). La
 * Biblia completa está a un toque en la pestaña Biblia; antes el mosaico y la
 * línea eran dos toques anidados (problema de accesibilidad en `HomeCard`).
 */
export function ReadCard() {
  const { color } = useTheme();
  const separator = useQuery(api.reading.separator);
  const progress = useQuery(api.reading.progress);
  const status = readStatusLine(separator, progress);

  return (
    <HomeTile
      accessibilityHint={`Abre ${status.passage.book} ${status.passage.chapter}.`}
      icon="book"
      onPress={() => {
        track("home_card_opened");
        openPassage(status.passage);
      }}
      testID="home-card-read"
      title="Leer la Biblia"
    >
      <View style={styles.status} testID="home-read-status">
        <Icon color={color.accent} name="ribbon" size="sm" />
        <Text numberOfLines={2} style={[styles.statusLabel, { color: color.inkMuted }]}>
          {status.label}
        </Text>
      </View>
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.xs },
  statusLabel: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
