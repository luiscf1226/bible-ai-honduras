import { memo, useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";

import { voiceCharacters } from "../../../convex/voicesCatalog";
import { KenBurnsImage } from "../../components/KenBurnsImage";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { CharacterAvatar } from "../voices/CharacterAvatar";
import {
  createDoubleTapDetector,
  feedCaption,
  feedPassageTarget,
  feedVerseType,
  reelReference,
  type FeedReelItem,
  type FeedReelSceneItem,
} from "./feedLogic";
import {
  FeedAction,
  FeedCaption,
  FeedRail,
  feedStyles,
  HeartBurst,
  ReelProgress,
  useHeartBurst,
  type FeedExtraActions,
} from "./FeedParts";

type FeedReelPageProps = FeedExtraActions & {
  reel: FeedReelItem;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** La pantalla que se ve: su fondo se mueve y sus partes avanzan. */
  active: boolean;
  /** La parte que se ve (la maneja la pantalla del feed: avanza con la voz o con el tiempo de lectura). */
  sceneIndex: number;
  /** Cuánto dura la parte que se ve, para llenar su tramo de la barra; null si no avanza sola. */
  sceneMs: number | null;
  /** Lugar de esta pantalla en el feed: el cambio de parte solo vale para la pantalla que se ve. */
  pageIndex: number;
  /** VoiceOver/TalkBack: deslizar arriba/abajo sobre el texto pasa de parte. */
  onSceneChange: (pageIndex: number, scene: number) => void;
  onSetLike: (ref: string, liked: boolean) => void;
  onShare: (reel: FeedReelItem, sceneIndex: number) => void;
  onRead: (scene: FeedReelSceneItem) => void;
  onTalk: (slug: string) => void;
  shareDisabled: boolean;
};

const CHARACTERS = new Map(voiceCharacters.map((character) => [character.slug, character]));

/**
 * Un reel del feed (design/oleada-ux.md §Reels del feed y §Feed en modo
 * TikTok): una historia contada o un personaje que habla en 1ra persona. Las
 * partes se suceden como un video: la imagen funde a la siguiente, el texto
 * entra subiendo y la barra fina de abajo se llena parte por parte. El riel
 * lleva arriba el retrato del personaje (abre su chat) o la imagen de la
 * historia (abre el capítulo); mismo doble toque que un versículo.
 */
function FeedReelPageImpl({
  active,
  height,
  insetBottom,
  insetTop,
  onImage,
  onRead,
  onSceneChange,
  onSend,
  onSetLike,
  onShare,
  onTalk,
  pageIndex,
  reel,
  sceneIndex,
  sceneMs,
  shareDisabled,
}: FeedReelPageProps) {
  const { color } = useTheme();
  const reduceMotion = useReduceMotion();
  const [isDoubleTap] = useState(() => createDoubleTapDetector(tokens.motion.feedDoubleTap));
  const { burst, showBurst } = useHeartBurst();
  const index = Math.min(sceneIndex, reel.scenes.length - 1);
  const scene = reel.scenes[index];

  // Una opacidad por parte: la que se ve en 1, las demás en 0, con fundido al cambiar.
  const [fades] = useState(() => reel.scenes.map((_, scene) => new Animated.Value(scene === index ? 1 : 0)));
  useEffect(() => {
    fades.forEach((fade, scene) => {
      const toValue = scene === index ? 1 : 0;
      if (reduceMotion) fade.setValue(toValue);
      else Animated.timing(fade, { duration: tokens.motion.reelCrossfade, toValue, useNativeDriver: true }).start();
    });
  }, [fades, index, reduceMotion]);

  // El texto de cada parte entra subiendo, como el versículo (quieto con "reducir movimiento").
  const rise = useRef(new Animated.Value(active || reduceMotion ? 1 : 0)).current;
  const shown = useRef<number | null>(active ? index : null);
  useEffect(() => {
    if (!active || shown.current === index) return;
    shown.current = index;
    if (reduceMotion) {
      rise.setValue(1);
      return;
    }
    rise.setValue(0);
    Animated.timing(rise, { duration: tokens.motion.verseRise, toValue: 1, useNativeDriver: true }).start();
  }, [active, index, reduceMotion, rise]);

  const onPress = () => {
    if (!isDoubleTap(Date.now())) return;
    onSetLike(reel.ref, true);
    showBurst();
  };

  const character = reel.kind === "character" && reel.voiceSlug ? CHARACTERS.get(reel.voiceSlug) : undefined;
  // Una historia puede invitar a conversar con su personaje.
  const storyGuest = !character && reel.voiceSlug ? CHARACTERS.get(reel.voiceSlug) : undefined;
  const textType = tokens.type[feedVerseType(scene.text)];
  const reference = reelReference(reel, scene);
  const caption = feedCaption(reel, index);
  const many = reel.scenes.length > 1;
  const spoken =
    reel.kind === "character"
      ? `${reel.title}. ${scene.text}. ${reference}`
      : `${reel.title}, parte ${index + 1} de ${reel.scenes.length}. ${scene.text}. ${reference}`;
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment" && index + 1 < reel.scenes.length)
      onSceneChange(pageIndex, index + 1);
    if (event.nativeEvent.actionName === "decrement" && index > 0) onSceneChange(pageIndex, index - 1);
  };

  return (
    <View style={[styles.page, { backgroundColor: color.surfaceSunk, height }]} testID={`feed-page-${reel.ref}`}>
      {reel.scenes.map((part, scene) => (
        <Animated.View key={scene} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fades[scene] }]}>
          <KenBurnsImage
            accessibilityLabel={part.imageAlt}
            active={active && scene === index}
            seed={`${reel.ref}#${scene + 1}`}
            style={StyleSheet.absoluteFill}
            uri={part.imageUrl}
          />
        </Animated.View>
      ))}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
      <Pressable accessible={false} onPress={onPress} style={StyleSheet.absoluteFill} testID="feed-double-tap" />

      <View
        pointerEvents="box-none"
        style={[
          styles.body,
          { paddingBottom: insetBottom + tokens.space.xl, paddingTop: insetTop + tokens.size.feedAction },
        ]}
      >
        <View pointerEvents="box-none" style={feedStyles.column}>
          <View pointerEvents="none" style={feedStyles.center}>
            <Animated.View
              accessibilityActions={
                many
                  ? [
                      { name: "increment", label: "Parte siguiente" },
                      { name: "decrement", label: "Parte anterior" },
                    ]
                  : undefined
              }
              accessibilityLabel={spoken}
              accessibilityRole={many ? "adjustable" : undefined}
              accessible
              onAccessibilityAction={onAccessibilityAction}
              style={[
                styles.textBlock,
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
              {character ? null : (
                <Text
                  maxFontSizeMultiplier={tokens.fontScale.feedMax}
                  style={[styles.title, { color: tokens.color.surface }]}
                >
                  {reel.title}
                </Text>
              )}
              <Text
                maxFontSizeMultiplier={tokens.fontScale.feedMax}
                style={[
                  styles.text,
                  { color: tokens.color.surface, fontSize: textType.size, lineHeight: textType.lineHeight },
                ]}
                testID="reel-text"
              >
                {/* El personaje habla: va entre comillas. La historia se cuenta: sin comillas. */}
                {character ? `“${scene.text}”` : scene.text}
              </Text>
            </Animated.View>
          </View>
          <FeedCaption detail={caption.detail} source={caption.source} />
        </View>

        <FeedRail
          avatar={
            character ? (
              <CharacterAvatar character={character} size={tokens.size.feedAction - tokens.size.ring * 2} />
            ) : (
              <Image
                accessibilityIgnoresInvertColors
                resizeMode="cover"
                source={{ uri: reel.scenes[0].imageUrl }}
                style={StyleSheet.absoluteFill}
              />
            )
          }
          avatarLabel={character ? `Conversar con ${character.name}` : `Leer ${scene.reference}`}
          liked={reel.liked}
          likes={reel.likes}
          onAvatar={() => (character ? onTalk(character.slug) : onRead(scene))}
          onImage={onImage}
          onLike={() => onSetLike(reel.ref, !reel.liked)}
          onSend={onSend}
          onShare={() => onShare(reel, index)}
          shareDisabled={shareDisabled}
          shareLabel={reel.kind === "character" ? `Compartir lo que dice ${reel.title}` : "Compartir esta parte"}
          target={feedPassageTarget(reel, index)}
        >
          {character ? (
            <FeedAction
              accessibilityLabel={`Leer ${scene.reference}`}
              icon="book"
              label="Leer"
              onPress={() => onRead(scene)}
              testID="feed-read"
            />
          ) : storyGuest ? (
            <FeedAction
              accessibilityLabel={`Conversar con ${storyGuest.name}`}
              icon="voice"
              label="Conversar"
              onPress={() => onTalk(storyGuest.slug)}
              testID="feed-talk"
            />
          ) : null}
        </FeedRail>
      </View>

      {many ? <ReelProgress bottom={insetBottom} count={reel.scenes.length} index={index} sceneMs={sceneMs} /> : null}

      <HeartBurst burst={burst} />
    </View>
  );
}

export const FeedReelPage = memo(FeedReelPageImpl);

const styles = StyleSheet.create({
  page: { overflow: "hidden", width: "100%" },
  body: {
    flex: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  textBlock: { gap: tokens.space.md },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  text: { fontFamily: tokens.font.serif },
});
