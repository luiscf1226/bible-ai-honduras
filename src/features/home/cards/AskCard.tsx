import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { hondurasToday } from "../../widget/verseWidget";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { ASK_CARD_CAPTION, askExampleForDay, askExampleRoute, askQuotaLine, HOME_ROUTES } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Tarjeta 4, Preguntar sobre la Biblia (U1): una pregunta de ejemplo del día
 * (abre el chat con la pregunta escrita, no se envía sola) y la cuota de hoy.
 * La cuota sale solo de `api.quotas.remaining` (regla dura #3).
 */
export function AskCard() {
  const { color } = useTheme();
  const currentUser = useQuery(api.users.current);
  const quota = useQuery(api.quotas.remaining, currentUser ? { module: "qa" } : "skip");
  const example = askExampleForDay(hondurasToday());
  const quotaLine = askQuotaLine(quota);

  return (
    <HomeCard
      accessibilityHint="Abre Preguntar."
      caption={ASK_CARD_CAPTION}
      icon="chat"
      onPress={() => openFromHome(HOME_ROUTES.ask)}
      testID="home-card-ask"
      title="Preguntar sobre la Biblia"
    >
      <Pressable
        accessibilityHint="Abre Preguntar con esta pregunta escrita."
        accessibilityRole="button"
        onPress={() => openFromHome(askExampleRoute(example))}
        style={({ pressed }) => [styles.example, { backgroundColor: color.surfaceSunk }, pressed && styles.pressed]}
        testID="home-ask-example"
      >
        <Text style={[styles.exampleText, { color: color.ink }]}>“{example}”</Text>
      </Pressable>
      {quotaLine ? (
        <Text style={[styles.quota, { color: color.inkSoft }]} testID="home-ask-quota">
          {quotaLine}
        </Text>
      ) : null}
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: tokens.opacity.pressed },
  example: { borderRadius: tokens.radius.lg, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  exampleText: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
  },
  quota: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
