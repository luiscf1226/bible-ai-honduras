import { useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { Icon } from "../../../components/Icon";
import { KenBurnsImage } from "../../../components/KenBurnsImage";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { hondurasToday } from "../../widget/verseWidget";
import { FEED_CARD_OVERLINE, FEED_CARD_PLAY, FEED_CARD_TITLE, HOME_ROUTES } from "../homeCards";
import { openFromHome } from "./HomeCard";

/**
 * Tarjeta héroe del feed (design/oleada-ux.md §Feed en modo TikTok): una
 * vista previa en movimiento —la foto de una cita del día con el zoom lento
 * de Ken Burns— con los modos arriba y un ▶ "Para ti" que se ve como play de
 * video. Alto fijo (`size.feedHeroCard`): el versículo del día se encoge lo
 * que haga falta para que el inicio siga entrando en una pantalla (U1b).
 */
export function FeedCard() {
  const { color } = useTheme();
  const focused = useIsFocused();
  const preview = useQuery(api.verseFeed.preview, { dateKey: hondurasToday() });

  return (
    <Pressable
      accessibilityHint="Abre el feed a pantalla completa: versículos, historias y personajes para deslizar."
      accessibilityLabel={`${FEED_CARD_TITLE}. ${FEED_CARD_PLAY}`}
      accessibilityRole="button"
      onPress={() => openFromHome(HOME_ROUTES.feed)}
      style={({ pressed }) => [
        styles.card,
        // Oscura desde antes de que llegue la foto: el texto va en `surface` claro.
        { backgroundColor: tokens.night.color.bg, borderColor: color.border },
        pressed && styles.pressed,
      ]}
      testID="home-card-feed"
    >
      {preview ? (
        <KenBurnsImage
          accessibilityLabel={preview.imageAlt}
          active={focused}
          seed="inicio-feed"
          style={StyleSheet.absoluteFill}
          uri={preview.imageUrl}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
      <Text style={[styles.overline, { color: tokens.color.surface }]}>{FEED_CARD_OVERLINE}</Text>
      <View style={styles.footer}>
        <Text numberOfLines={2} style={[styles.title, { color: tokens.color.surface }]}>
          {FEED_CARD_TITLE}
        </Text>
        <View style={[styles.play, { backgroundColor: tokens.color.surface }]}>
          <Icon color={tokens.color.ink} filled name="play" size="sm" />
          <Text style={[styles.playLabel, { color: tokens.color.ink }]}>{FEED_CARD_PLAY}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    height: tokens.size.feedHeroCard,
    justifyContent: "space-between",
    overflow: "hidden",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  footer: { alignItems: "flex-end", flexDirection: "row", gap: tokens.space.md },
  title: {
    flex: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verseHero.size,
    lineHeight: tokens.type.verseHero.lineHeight,
  },
  play: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  playLabel: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
});
