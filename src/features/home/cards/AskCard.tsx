import { Pressable, StyleSheet, Text } from "react-native";

import { hondurasToday } from "../../widget/verseWidget";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { askExampleForDay, askExampleRoute, HOME_ROUTES } from "../homeCards";
import { HomeTile, openFromHome } from "./HomeCard";

/**
 * Mosaico Preguntar (U1b): la pregunta de ejemplo del día. Tocarla abre el
 * chat con la pregunta escrita (no se envía sola); el mosaico, Preguntar. La
 * cuota se ve adentro, donde sale de `api.quotas.remaining` (regla dura #3).
 */
export function AskCard() {
  const { color } = useTheme();
  const example = askExampleForDay(hondurasToday());

  return (
    <HomeTile
      accessibilityHint="Abre Preguntar."
      icon="chat"
      onPress={() => openFromHome(HOME_ROUTES.ask)}
      testID="home-card-ask"
      title="Preguntar"
    >
      <Pressable
        accessibilityHint="Abre Preguntar con esta pregunta escrita."
        accessibilityRole="button"
        hitSlop={tokens.space.xs}
        onPress={() => openFromHome(askExampleRoute(example))}
        style={({ pressed }) => pressed && styles.pressed}
        testID="home-ask-example"
      >
        <Text numberOfLines={2} style={[styles.example, { color: color.inkMuted }]}>
          “{example}”
        </Text>
      </Pressable>
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  example: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
