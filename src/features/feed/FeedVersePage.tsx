import { memo, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { KenBurnsImage } from "../../components/KenBurnsImage";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import {
  createDoubleTapDetector,
  feedCaption,
  feedPassageTarget,
  feedReference,
  feedVerseText,
  feedVerseType,
  type FeedItem,
} from "./feedLogic";
import {
  FeedBookAvatar,
  FeedCaption,
  FeedRail,
  feedStyles,
  HeartBurst,
  useHeartBurst,
  type FeedExtraActions,
} from "./FeedParts";

type FeedVersePageProps = FeedExtraActions & {
  item: FeedItem;
  height: number;
  /** Margen de arriba y abajo para no quedar debajo de la isla / la barra del sistema. */
  insetTop: number;
  insetBottom: number;
  /** La pantalla que se ve: su fondo se mueve y su versículo entra subiendo. */
  active: boolean;
  onSetLike: (ref: string, liked: boolean) => void;
  onShare: (item: FeedItem) => void;
  onRead: (item: FeedItem) => void;
  shareDisabled: boolean;
};

/**
 * Una pantalla del feed (design/oleada-ux.md §Feed de versículos y §Feed en
 * modo TikTok): la imagen a pantalla completa con `imageScrim`, el versículo
 * en serif al centro (más chico cuanto más largo, para que entre sin scroll),
 * la leyenda "@RV1909" con la cita y el tema abajo a la izquierda, y a la
 * derecha el riel: el libro (abre el capítulo), ♥, Compartir y, si vienen,
 * Imagen y Enviar. Doble toque en cualquier lado = ♥ con un corazón grande
 * que aparece y se va (con VoiceOver/TalkBack, el ♥ es el botón).
 */
function FeedVersePageImpl({
  active,
  height,
  insetBottom,
  insetTop,
  item,
  onImage,
  onRead,
  onSend,
  onSetLike,
  onShare,
  shareDisabled,
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
  const caption = feedCaption(item, 0);

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
        como un solo elemento y no llegaría al riel.
      */}
      <Pressable accessible={false} onPress={onPress} style={StyleSheet.absoluteFill} testID="feed-double-tap" />

      {/* Texto sobre la foto: siempre el `surface` claro, también de noche. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.body,
          {
            paddingBottom: insetBottom + tokens.space.xl,
            paddingTop: insetTop + tokens.size.feedAction,
          },
        ]}
      >
        <View pointerEvents="box-none" style={feedStyles.column}>
          <View pointerEvents="none" style={feedStyles.center}>
            <Animated.View
              accessibilityLabel={`${text}. ${feedReference(item)}`}
              accessible
              style={{
                opacity: rise,
                transform: [
                  {
                    translateY: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [tokens.motion.verseRiseDistance, 0],
                    }),
                  },
                ],
              }}
            >
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
            </Animated.View>
          </View>
          <FeedCaption detail={caption.detail} source={caption.source} />
        </View>

        <FeedRail
          avatar={<FeedBookAvatar />}
          avatarLabel={`Leer ${item.book} ${item.chapter}`}
          liked={item.liked}
          likes={item.likes}
          onAvatar={() => onRead(item)}
          onImage={onImage}
          onLike={() => onSetLike(item.ref, !item.liked)}
          onSend={onSend}
          onShare={() => onShare(item)}
          shareDisabled={shareDisabled}
          shareLabel="Compartir versículo"
          target={feedPassageTarget(item, 0)}
        />
      </View>

      <HeartBurst burst={burst} />
    </View>
  );
}

export const FeedVersePage = memo(FeedVersePageImpl);

const styles = StyleSheet.create({
  page: { overflow: "hidden", width: "100%" },
  body: {
    flex: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  verse: { fontFamily: tokens.font.serif },
});
