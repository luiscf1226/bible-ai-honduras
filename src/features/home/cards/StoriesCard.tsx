import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "../../../components/Icon";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { storiesApi } from "../../stories/contracts";
import { hondurasToday } from "../../widget/verseWidget";
import { HOME_ROUTES, pickForDay, STORIES_CARD_CAPTION } from "../homeCards";
import { HomeCard, openFromHome } from "./HomeCard";

/**
 * Tarjeta 6, Historias (U1): una historia del catálogo, distinta cada día, con
 * su miniatura y título. El catálogo no trae portada: la miniatura es un
 * recuadro `surfaceSunk` con el ícono de imagen hasta que la haya.
 */
export function StoriesCard() {
  const { color } = useTheme();
  const stories = useQuery(storiesApi.stories.list, {});
  const story = pickForDay(stories ?? [], hondurasToday());

  return (
    <HomeCard
      accessibilityHint="Abre Historias."
      caption={STORIES_CARD_CAPTION}
      icon="image"
      onPress={() => openFromHome(HOME_ROUTES.stories)}
      testID="home-card-stories"
      title="Historias"
    >
      {story ? (
        <View style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: color.surfaceSunk }]}>
            <Icon color={color.accent} name="image" size="lg" />
          </View>
          <View style={styles.text}>
            <Text numberOfLines={2} style={[styles.title, { color: color.ink }]}>
              {story.title}
            </Text>
            <Text numberOfLines={1} style={[styles.reference, { color: color.inkSoft }]}>
              {story.reference}
            </Text>
          </View>
        </View>
      ) : null}
    </HomeCard>
  );
}

const THUMB = tokens.size.verseCardImage / 2;

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: tokens.space.lg },
  thumb: { alignItems: "center", borderRadius: tokens.radius.lg, height: THUMB, justifyContent: "center", width: THUMB },
  text: { flex: 1, gap: tokens.space.xxs },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  reference: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
