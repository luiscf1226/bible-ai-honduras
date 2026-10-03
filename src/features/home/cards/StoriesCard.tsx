import { useQuery } from "convex/react";
import { StyleSheet, Text } from "react-native";

import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { storiesApi } from "../../stories/contracts";
import { hondurasToday } from "../../widget/verseWidget";
import { HOME_ROUTES, pickForDay, STORIES_CARD_CAPTION } from "../homeCards";
import { HomeTile, openFromHome } from "./HomeCard";

/**
 * Mosaico Historias (U1b): el título de una historia del catálogo, distinta
 * cada día. Mientras carga (o sin catálogo), qué ofrece el módulo.
 */
export function StoriesCard() {
  const { color } = useTheme();
  const stories = useQuery(storiesApi.stories.list, {});
  const story = pickForDay(stories ?? [], hondurasToday());

  return (
    <HomeTile
      accessibilityHint="Abre Historias."
      icon="image"
      onPress={() => openFromHome(HOME_ROUTES.stories)}
      testID="home-card-stories"
      title="Historias"
    >
      <Text numberOfLines={2} style={[styles.line, { color: color.inkMuted }]}>
        {story ? `Hoy: ${story.title}` : STORIES_CARD_CAPTION}
      </Text>
    </HomeTile>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
