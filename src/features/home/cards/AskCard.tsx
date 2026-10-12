import { StyleSheet, Text } from "react-native";

import { hondurasToday } from "../../widget/verseWidget";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { askExampleForDay, askExampleRoute } from "../homeCards";
import { HomeTile, openFromHome } from "./HomeCard";

/**
 * Mosaico Preguntar (U1b): la pregunta de ejemplo del día. Desde #232 tiene
 * **un solo destino**: Preguntar con esa pregunta escrita en el campo (no se
 * envía sola). La cuota se ve adentro, donde sale de `api.quotas.remaining`
 * (regla dura #3).
 */
export function AskCard() {
  const { color } = useTheme();
  const example = askExampleForDay(hondurasToday());

  return (
    <HomeTile
      accessibilityHint="Abre Preguntar con esta pregunta escrita."
      icon="chat"
      onPress={() => openFromHome(askExampleRoute(example))}
      testID="home-card-ask"
      title="Preguntar"
    >
      <Text numberOfLines={2} style={[styles.example, { color: color.inkMuted }]} testID="home-ask-example">
        “{example}”
      </Text>
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  example: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
