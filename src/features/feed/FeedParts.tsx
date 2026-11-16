import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { formatLikes, type FeedPassageTarget } from "./feedLogic";

/**
 * Piezas que comparten las pantallas del feed (versículo y reel): el riel de
 * acciones, la leyenda, la pista de la primera vez y el corazón grande del
 * doble toque (design/oleada-ux.md §Feed de versículos y §Feed en modo TikTok).
 */

/** El corazón grande: aparece con un resorte y se va en `motion.feedHeart` (quieto con "reducir movimiento"). */
export function useHeartBurst() {
  const reduceMotion = useReduceMotion();
  const burst = useRef(new Animated.Value(0)).current;
  const showBurst = () => {
    burst.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {
      Animated.timing(burst, {
        delay: tokens.motion.feedHeart,
        duration: 0,
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.sequence([
      Animated.spring(burst, {
        friction: 4,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(burst, {
        duration: tokens.motion.feedHeart,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };
  return { burst, showBurst };
}

export function HeartBurst({ burst }: { burst: Animated.Value }) {
  const { color } = useTheme();
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.burst,
        {
          opacity: burst,
          transform: [
            {
              scale: burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.burstHeart}>
        <BigHeart color={color.accent} />
      </View>
    </Animated.View>
  );
}

function BigHeart({ color }: { color: string }) {
  // El ícono de 24 escalado al tamaño `feedHeart`: mismo trazo del set, relleno.
  return (
    <View
      style={{
        transform: [{ scale: tokens.size.feedHeart / tokens.size.icon.lg }],
      }}
    >
      <Icon color={color} filled name="heart" size="lg" />
    </View>
  );
}

type FeedActionProps = {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID: string;
  filled?: boolean;
  selected?: boolean;
  disabled?: boolean;
  iconColor?: string;
};

export function FeedAction({
  accessibilityLabel,
  disabled,
  filled,
  icon,
  iconColor,
  label,
  onPress,
  selected,
  testID,
}: FeedActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.action, (pressed || disabled) && styles.pressed]}
      testID={testID}
    >
      <View style={styles.actionCircle}>
        <View style={[StyleSheet.absoluteFill, styles.actionFill, { backgroundColor: tokens.color.surface }]} />
        <Icon color={iconColor ?? tokens.color.surface} filled={filled} name={icon} size="xl" />
      </View>
      {label ? <Text style={[styles.actionLabel, { color: tokens.color.surface }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Lo que el feed pasa a cada pantalla para "Imagen" y "Enviar": sin función, el botón no se muestra. */
export type FeedExtraActions = {
  onImage?: (target: FeedPassageTarget) => void;
  onSend?: (target: FeedPassageTarget) => void;
};

type FeedRailProps = FeedExtraActions & {
  /** El círculo de arriba: el libro, el retrato del personaje o la imagen de la historia. */
  avatar: ReactNode;
  avatarLabel: string;
  onAvatar: () => void;
  liked: boolean;
  likes: number;
  onLike: () => void;
  shareLabel: string;
  shareDisabled: boolean;
  onShare: () => void;
  /** El versículo de lo que se ve; sin versículo (una parte que cita un capítulo), no hay Imagen ni Enviar. */
  target: FeedPassageTarget | null;
  /** Acciones propias de la pantalla, al final ("Conversar", "Leer"). */
  children?: ReactNode;
};

/**
 * Riel derecho, como TikTok: avatar circular arriba, ♥ con la cuenta de la
 * comunidad, Compartir (por `shareContent`, regla dura #3) y, si vienen,
 * Imagen y Enviar.
 */
export function FeedRail({
  avatar,
  avatarLabel,
  children,
  liked,
  likes,
  onAvatar,
  onImage,
  onLike,
  onSend,
  onShare,
  shareDisabled,
  shareLabel,
  target,
}: FeedRailProps) {
  const { color } = useTheme();
  return (
    <View style={styles.rail}>
      <Pressable
        accessibilityLabel={avatarLabel}
        accessibilityRole="button"
        onPress={onAvatar}
        style={({ pressed }) => [styles.avatar, { borderColor: tokens.color.surface }, pressed && styles.pressed]}
        testID="feed-avatar"
      >
        {avatar}
      </Pressable>
      <FeedAction
        accessibilityLabel={liked ? "Quitar ♥" : "Dar ♥"}
        filled={liked}
        icon="heart"
        iconColor={liked ? color.accent : tokens.color.surface}
        label={formatLikes(likes)}
        onPress={onLike}
        selected={liked}
        testID="feed-like"
      />
      <FeedAction
        accessibilityLabel={shareLabel}
        disabled={shareDisabled}
        icon="whatsapp"
        label="Compartir"
        onPress={onShare}
        testID="feed-share"
      />
      {onImage && target ? (
        <FeedAction
          accessibilityLabel="Hacer una imagen del versículo"
          icon="image"
          label="Imagen"
          onPress={() => onImage(target)}
          testID="feed-image"
        />
      ) : null}
      {onSend && target ? (
        <FeedAction
          accessibilityLabel="Enviar a un amigo"
          icon="send"
          label="Enviar"
          onPress={() => onSend(target)}
          testID="feed-send"
        />
      ) : null}
      {children}
    </View>
  );
}

/** El ícono del libro dentro del avatar de un versículo. */
export function FeedBookAvatar() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bookAvatar]}>
      <View style={[StyleSheet.absoluteFill, styles.actionFill, { backgroundColor: tokens.color.surface }]} />
      <Icon color={tokens.color.surface} name="book" size="lg" />
    </View>
  );
}

/** Leyenda de abajo a la izquierda: "@fuente" y una línea con la cita y el tema. */
export function FeedCaption({ detail, source }: { source: string; detail: string }) {
  return (
    <View accessibilityLabel={`${source.replace(/^@/, "")}. ${detail}`} accessible pointerEvents="none" style={styles.caption}>
      <Text
        maxFontSizeMultiplier={tokens.fontScale.feedMax}
        numberOfLines={1}
        style={[styles.captionSource, { color: tokens.color.surface }]}
      >
        {source}
      </Text>
      <Text
        maxFontSizeMultiplier={tokens.fontScale.feedMax}
        numberOfLines={2}
        style={[styles.captionDetail, { color: tokens.color.surface }]}
        testID="feed-caption"
      >
        {detail}
      </Text>
    </View>
  );
}

/**
 * Pista de la primera vez: una flecha que sube y baja, "Deslizá hacia arriba"
 * y cómo cambiar de modo. Se va sola (la maneja la pantalla); con "reducir
 * movimiento" la flecha queda quieta.
 */
export function FeedSwipeHint({ bottom, visible }: { visible: boolean; bottom: number }) {
  const reduceMotion = useReduceMotion();
  const bounce = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { duration: tokens.motion.verseRise, toValue: visible ? 1 : 0, useNativeDriver: true }).start();
    if (!visible || reduceMotion) return;
    const half = (toValue: number) =>
      Animated.timing(bounce, {
        duration: tokens.motion.feedHintBounce / 2,
        easing: Easing.inOut(Easing.quad),
        toValue,
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([half(1), half(0)]));
    loop.start();
    return () => loop.stop();
  }, [bounce, fade, reduceMotion, visible]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.hint, { bottom, opacity: fade }]}
      testID={visible ? "feed-swipe-hint" : undefined}
    >
      <View style={[styles.hintPill, { backgroundColor: tokens.night.color.imageScrim }]}>
        <Animated.View
          style={{
            transform: [
              { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -tokens.motion.verseRiseDistance] }) },
              { rotate: "180deg" },
            ],
          }}
        >
          <Icon color={tokens.color.surface} name="chevronDown" size="lg" />
        </Animated.View>
        <Text style={[styles.hintTitle, { color: tokens.color.surface }]}>Deslizá hacia arriba</Text>
        <Text style={[styles.hintDetail, { color: tokens.color.surface }]}>o de lado para cambiar de modo</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Barra fina de las partes de un reel, pegada abajo: lo visto lleno, la parte
 * que se ve se llena en lo que dura (`sceneMs`; sin avance solo —lector de
 * pantalla— queda llena) y lo que falta al `opacity.reelTrack`.
 */
export function ReelProgress({ bottom, count, index, sceneMs }: { count: number; index: number; sceneMs: number | null; bottom: number }) {
  const reduceMotion = useReduceMotion();
  const fill = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (sceneMs === null || reduceMotion) {
      fill.setValue(1);
      return;
    }
    fill.setValue(0);
    const run = Animated.timing(fill, { duration: sceneMs, easing: Easing.linear, toValue: 1, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [fill, index, reduceMotion, sceneMs]);

  return (
    <View pointerEvents="none" style={[styles.progress, { bottom }]} testID="reel-progress">
      {Array.from({ length: count }, (_, segment) => (
        <View key={segment} style={styles.segment}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.color.surface, opacity: tokens.opacity.reelTrack }]} />
          {segment < index ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.color.surface }]} />
          ) : segment === index ? (
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.segmentFill, { backgroundColor: tokens.color.surface, transform: [{ scaleX: fill }] }]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export const feedStyles = StyleSheet.create({
  // Columna del texto: el contenido centrado en el alto y la leyenda abajo.
  column: { flex: 1, gap: tokens.space.lg },
  center: { flex: 1, justifyContent: "center" },
});

const styles = StyleSheet.create({
  action: { alignItems: "center", gap: tokens.space.xs },
  actionCircle: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.feedAction,
    justifyContent: "center",
    overflow: "hidden",
    width: tokens.size.feedAction,
  },
  actionFill: { opacity: tokens.opacity.feedActionFill },
  actionLabel: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  pressed: { opacity: tokens.opacity.pressed },
  rail: { alignItems: "center", alignSelf: "flex-end", gap: tokens.space.lg },
  avatar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.size.ring,
    height: tokens.size.feedAction,
    justifyContent: "center",
    overflow: "hidden",
    width: tokens.size.feedAction,
  },
  bookAvatar: { alignItems: "center", justifyContent: "center" },
  caption: { gap: tokens.space.xxs },
  captionSource: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  captionDetail: {
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  hint: { alignItems: "center", left: 0, position: "absolute", right: 0 },
  hintPill: {
    alignItems: "center",
    borderRadius: tokens.radius.xxl,
    gap: tokens.space.xxs,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  hintTitle: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  hintDetail: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  progress: { flexDirection: "row", gap: tokens.space.xxs, left: 0, position: "absolute", right: 0 },
  segment: { flex: 1, height: tokens.size.reelProgress, overflow: "hidden" },
  segmentFill: { transformOrigin: "left" },
  burst: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 },
  burstHeart: {
    alignItems: "center",
    height: tokens.size.feedHeart,
    justifyContent: "center",
    width: tokens.size.feedHeart,
  },
});
