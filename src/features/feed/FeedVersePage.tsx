import { memo, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { KenBurnsImage } from "../../components/KenBurnsImage";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import {
  createDoubleTapDetector,
  feedReference,
  feedVerseText,
  feedVerseType,
  formatLikes,
  type FeedItem,
} from "./feedLogic";
import { FeedAction, feedStyles, HeartBurst, useHeartBurst } from "./FeedParts";

type FeedVersePageProps = {
  item: FeedItem;
  height: number;
  /** Margen de arriba y abajo para no quedar debajo de la isla / la barra del sistema. */
  insetTop: number;
  insetBottom: number;
  /** Solo la primera pantalla invita a deslizar. */
  showHint: boolean;
  /** La pantalla que se ve: su fondo se mueve y su versículo entra subiendo. */
  active: boolean;
  onSetLike: (ref: string, liked: boolean) => void;
  onShare: (item: FeedItem) => void;
  onRead: (item: FeedItem) => void;
  shareDisabled: boolean;
};

/**
 * Una pantalla del feed (design/oleada-ux.md §Feed de versículos): la foto del
 * devocional a pantalla completa con `imageScrim`, el tema en `overline`, el
 * versículo en serif (más chico cuanto más largo, para que entre sin scroll),
 * la cita, y a la derecha la columna ♥ / Compartir / Leer. Doble toque en
 * cualquier lado = ♥ con un corazón grande que aparece y se va (con
 * VoiceOver/TalkBack, el ♥ es el botón).
 */
function FeedVersePageImpl({
  active,
  height,
  insetBottom,
  insetTop,
  item,
  onRead,
  onSetLike,
  onShare,
  shareDisabled,
  showHint,
}: FeedVersePageProps) {
  const { color } = useTheme();
  const reduceMotion = useReduceMotion();
  const [isDoubleTap] = useState(() => createDoubleTapDetector(tokens.motion.feedDoubleTap));
  const { burst, showBurst } = useHeartBurst();
  // Entrada del versículo: 0 = abajo y transparente, 1 = en su lugar. Solo la primera vez que se ve.
  const rise = useRef(new Animated.Value(active || reduceMotion ? 1 : 0)).current;
  const risen = useRef(active);
  useEffect(() => {
    if (!active || risen.current) return;
    risen.current = true;
    if (reduceMotion) {
      rise.setValue(1);
      return;
    }
    rise.setValue(0);
    Animated.timing(rise, { duration: tokens.motion.verseRise, toValue: 1, useNativeDriver: true }).start();
  }, [active, reduceMotion, rise]);
  const text = feedVerseText(item.text);
  const verseType = tokens.type[feedVerseType(text)];

  const onPress = () => {
    if (!isDoubleTap(Date.now())) return;
    // Doble toque solo da ♥ (como en todos lados); quitarlo es con el botón.
    onSetLike(item.ref, true);
    showBurst();
  };

  return (
    <View style={[styles.page, { backgroundColor: color.surfaceSunk, height }]} testID={`feed-page-${item.ref}`}>
      {/* Animación propia: zoom lento con paseo mientras la pantalla está a la vista. */}
      <KenBurnsImage
        accessibilityLabel={item.imageAlt}
        active={active}
        seed={item.ref}
        style={StyleSheet.absoluteFill}
        uri={item.imageUrl}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
      {/*
        El doble toque vive en una capa detrás del contenido y fuera de la
        accesibilidad: si toda la página fuera un botón, VoiceOver la leería
        como un solo elemento y no llegaría a ♥ / Compartir / Leer.
      */}
      <Pressable accessible={false} onPress={onPress} style={StyleSheet.absoluteFill} testID="feed-double-tap" />

      {/* Texto sobre la foto: siempre el `surface` claro, también de noche. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.body,
          {
            paddingBottom: insetBottom + tokens.space.xxl,
            paddingTop: insetTop + tokens.size.feedAction,
          },
        ]}
      >
        <Animated.View
          accessibilityLabel={`${text}. ${feedReference(item)}`}
          accessible
          pointerEvents="none"
          style={[
            styles.verseBlock,
            {
              opacity: rise,
              transform: [
                {
                  translateY: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [tokens.motion.verseRiseDistance, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={[styles.overline, { color: tokens.color.surface }]}>
            {(item.topic ?? "Versículo").toUpperCase()}
          </Text>
          <Text
            maxFontSizeMultiplier={tokens.fontScale.feedMax}
            style={[
              styles.verse,
              {
                color: tokens.color.surface,
                fontSize: verseType.size,
                lineHeight: verseType.lineHeight,
              },
            ]}
            testID="feed-verse-text"
          >
            “{text}”
          </Text>
          <Text
            maxFontSizeMultiplier={tokens.fontScale.feedMax}
            style={[styles.reference, { color: tokens.color.surface }]}
          >
            {feedReference(item)}
          </Text>
        </Animated.View>

        <View style={feedStyles.actions}>
          <FeedAction
            accessibilityLabel={item.liked ? "Quitar ♥" : "Dar ♥"}
            filled={item.liked}
            icon="heart"
            iconColor={item.liked ? color.accent : tokens.color.surface}
            label={formatLikes(item.likes)}
            onPress={() => onSetLike(item.ref, !item.liked)}
            selected={item.liked}
            testID="feed-like"
          />
          <FeedAction
            accessibilityLabel="Compartir versículo"
            disabled={shareDisabled}
            icon="whatsapp"
            label="Compartir"
            onPress={() => onShare(item)}
            testID="feed-share"
          />
          <FeedAction
            accessibilityLabel="Leer el capítulo"
            icon="book"
            label="Leer"
            onPress={() => onRead(item)}
            testID="feed-read"
          />
        </View>
      </View>

      {showHint ? (
        <View pointerEvents="none" style={[styles.hint, { bottom: insetBottom + tokens.space.xs }]}>
          <Icon color={tokens.color.surface} name="chevronDown" size="sm" />
          <Text style={[styles.hintText, { color: tokens.color.surface }]}>Deslizá para ver más</Text>
        </View>
      ) : null}

      <HeartBurst burst={burst} />
    </View>
  );
}

export const FeedVersePage = memo(FeedVersePageImpl);

const styles = StyleSheet.create({
  page: { overflow: "hidden", width: "100%" },
  body: {
    alignItems: "flex-end",
    flex: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  verseBlock: { alignSelf: "center", flex: 1, gap: tokens.space.lg },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  verse: { fontFamily: tokens.font.serif },
  reference: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  hint: { alignItems: "center", alignSelf: "center", gap: tokens.space.xxs, position: "absolute" },
  hintText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
});
