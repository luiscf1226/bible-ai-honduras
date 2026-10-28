import { memo, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";

import { voiceCharacters } from "../../../convex/voicesCatalog";
import { KenBurnsImage } from "../../components/KenBurnsImage";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { CharacterAvatar } from "../voices/CharacterAvatar";
import {
  createDoubleTapDetector,
  feedVerseType,
  formatLikes,
  reelOverline,
  reelReference,
  type FeedReelItem,
  type FeedReelSceneItem,
} from "./feedLogic";
import { FeedAction, feedStyles, HeartBurst, useHeartBurst } from "./FeedParts";

type FeedReelPageProps = {
  reel: FeedReelItem;
  height: number;
  insetTop: number;
  insetBottom: number;
  /** La pantalla que se ve: su fondo se mueve y sus partes avanzan. */
  active: boolean;
  /** La parte que se ve (la maneja la pantalla del feed: avanza con la voz o con el tiempo de lectura). */
  sceneIndex: number;
  /** VoiceOver/TalkBack: deslizar arriba/abajo sobre el texto pasa de parte. */
  onSceneChange: (index: number) => void;
  onSetLike: (ref: string, liked: boolean) => void;
  onShare: (reel: FeedReelItem, sceneIndex: number) => void;
  onRead: (scene: FeedReelSceneItem) => void;
  onTalk: (slug: string) => void;
  shareDisabled: boolean;
};

const CHARACTERS = new Map(voiceCharacters.map((character) => [character.slug, character]));

/**
 * Un reel del feed (design/oleada-ux.md §Reels del feed): una historia contada
 * o un personaje que habla en 1ra persona. Las partes se suceden como un
 * video: la imagen funde a la siguiente, el texto entra subiendo y arriba una
 * barra de tramos dice en qué parte va. Misma columna de acciones y mismo
 * doble toque que un versículo, más "Conversar" cuando hay un personaje.
 */
function FeedReelPageImpl({
  active,
  height,
  insetBottom,
  insetTop,
  onRead,
  onSceneChange,
  onSetLike,
  onShare,
  onTalk,
  reel,
  sceneIndex,
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
  const textType = tokens.type[feedVerseType(scene.text)];
  const reference = reelReference(reel, scene);
  const many = reel.scenes.length > 1;
  const spoken =
    reel.kind === "character"
      ? `${reel.title}. ${scene.text}. ${reference}`
      : `${reel.title}, parte ${index + 1} de ${reel.scenes.length}. ${scene.text}. ${reference}`;
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment" && index + 1 < reel.scenes.length) onSceneChange(index + 1);
    if (event.nativeEvent.actionName === "decrement" && index > 0) onSceneChange(index - 1);
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

      {many ? (
        // Tramos de las partes, en la fila del ‹ y el sonido (entre los dos botones).
        <View
          pointerEvents="none"
          style={[
            styles.progress,
            { top: insetTop + tokens.space.sm + (tokens.size.backButton - tokens.size.reelProgress) / 2 },
          ]}
          testID="reel-progress"
        >
          {reel.scenes.map((_, scene) => (
            <View
              key={scene}
              style={[
                styles.segment,
                { backgroundColor: tokens.color.surface, opacity: scene <= index ? 1 : tokens.opacity.reelTrack },
              ]}
            />
          ))}
        </View>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[
          styles.body,
          { paddingBottom: insetBottom + tokens.space.xxl, paddingTop: insetTop + tokens.size.feedAction },
        ]}
      >
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
          pointerEvents="none"
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
          {character ? (
            <View style={styles.speaker}>
              <CharacterAvatar character={character} size={tokens.size.cardAvatar} />
              <View style={styles.speakerText}>
                <Text style={[styles.title, { color: tokens.color.surface }]}>{reel.title}</Text>
                <Text
                  maxFontSizeMultiplier={tokens.fontScale.feedMax}
                  style={[styles.tag, { color: tokens.color.surface }]}
                >
                  {reel.subtitle}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.heading}>
              <Text style={[styles.overline, { color: tokens.color.surface }]}>{reelOverline(reel, index)}</Text>
              <Text
                maxFontSizeMultiplier={tokens.fontScale.feedMax}
                style={[styles.title, { color: tokens.color.surface }]}
              >
                {reel.title}
              </Text>
            </View>
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
          <Text
            maxFontSizeMultiplier={tokens.fontScale.feedMax}
            style={[styles.reference, { color: tokens.color.surface }]}
          >
            {reference}
          </Text>
        </Animated.View>

        <View style={feedStyles.actions}>
          <FeedAction
            accessibilityLabel={reel.liked ? "Quitar ♥" : "Dar ♥"}
            filled={reel.liked}
            icon="heart"
            iconColor={reel.liked ? color.accent : tokens.color.surface}
            label={formatLikes(reel.likes)}
            onPress={() => onSetLike(reel.ref, !reel.liked)}
            selected={reel.liked}
            testID="feed-like"
          />
          <FeedAction
            accessibilityLabel={
              reel.kind === "character" ? `Compartir lo que dice ${reel.title}` : "Compartir esta parte"
            }
            disabled={shareDisabled}
            icon="whatsapp"
            label="Compartir"
            onPress={() => onShare(reel, index)}
            testID="feed-share"
          />
          {reel.voiceSlug && CHARACTERS.has(reel.voiceSlug) ? (
            <FeedAction
              accessibilityLabel={`Conversar con ${CHARACTERS.get(reel.voiceSlug)!.name}`}
              icon="voice"
              label="Conversar"
              onPress={() => onTalk(reel.voiceSlug!)}
              testID="feed-talk"
            />
          ) : null}
          <FeedAction
            accessibilityLabel={`Leer ${scene.reference}`}
            icon="book"
            label="Leer"
            onPress={() => onRead(scene)}
            testID="feed-read"
          />
        </View>
      </View>

      <HeartBurst burst={burst} />
    </View>
  );
}

export const FeedReelPage = memo(FeedReelPageImpl);

const styles = StyleSheet.create({
  page: { overflow: "hidden", width: "100%" },
  progress: {
    flexDirection: "row",
    gap: tokens.space.xs,
    left: tokens.screenPadding.horizontal + tokens.size.backButton + tokens.space.md,
    position: "absolute",
    right: tokens.screenPadding.horizontal + tokens.size.backButton + tokens.space.md,
  },
  segment: { borderRadius: tokens.radius.pill, flex: 1, height: tokens.size.reelProgress },
  body: {
    alignItems: "flex-end",
    flex: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  textBlock: { alignSelf: "center", flex: 1, gap: tokens.space.lg },
  heading: { gap: tokens.space.xs },
  speaker: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  speakerText: { flex: 1 },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  tag: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  text: { fontFamily: tokens.font.serif },
  reference: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
});
