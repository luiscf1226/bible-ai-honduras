import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { Icon } from "../../../components/Icon";
import { openPassage } from "../../../lib/openPassage";
import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { HOME_ROUTES, READ_CARD_CAPTION, READ_CHIPS, readStatusLine } from "../homeCards";
import { HomeCard, HomeChip, openFromHome } from "./HomeCard";

/**
 * Tarjeta 2, Leer la Biblia (U1): dice lo que Leer ofrece sin entrar. Línea
 * de estado (separador / seguí leyendo / Génesis 1) y los 4 chips.
 */
export function ReadCard() {
  const { color } = useTheme();
  const separator = useQuery(api.reading.separator);
  const progress = useQuery(api.reading.progress);
  const status = readStatusLine(separator, progress);

  return (
    <HomeCard
      accessibilityHint="Abre la Biblia completa."
      caption={READ_CARD_CAPTION}
      icon="book"
      onPress={() => openFromHome(HOME_ROUTES.read)}
      testID="home-card-read"
      title="Leer la Biblia"
    >
      <Pressable
        accessibilityHint={`Abre ${status.passage.book} ${status.passage.chapter}.`}
        accessibilityRole="button"
        onPress={() => {
          track("home_card_opened");
          openPassage(status.passage);
        }}
        style={({ pressed }) => [styles.status, { backgroundColor: color.surfaceSunk }, pressed && styles.pressed]}
        testID="home-read-status"
      >
        <Icon color={color.accent} name="ribbon" size="sm" />
        <Text numberOfLines={1} style={[styles.statusLabel, { color: color.ink }]}>
          {status.label}
        </Text>
      </Pressable>
      <View style={styles.chips}>
        {READ_CHIPS.map((chip) => (
          <HomeChip
            accessibilityHint={`Abre ${chip.label.toLowerCase()}.`}
            icon={chip.icon}
            key={chip.id}
            label={chip.label}
            onPress={() => openFromHome(chip.route)}
            testID={`home-read-${chip.id}`}
          />
        ))}
      </View>
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  status: {
    alignItems: "center",
    borderRadius: tokens.radius.lg,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  statusLabel: { flex: 1, fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
});
