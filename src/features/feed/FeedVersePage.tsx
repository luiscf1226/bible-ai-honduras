import { memo, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { createDoubleTapDetector, feedReference, feedVerseText, feedVerseType, formatLikes, type FeedItem } from "./feedLogic";

type FeedVersePageProps = {
  item: FeedItem;
  height: number;
  /** Margen de arriba y abajo para no quedar debajo de la isla / la barra del sistema. */
  insets: { top: number; bottom: number };
  /** Solo la primera pantalla invita a deslizar. */
  showHint: boolean;
  onToggleLike: (ref: string) => void;
  onShare: (item: FeedItem) => void;
  onRead: (item: FeedItem) => void;
  shareDisabled: boolean;
};

/**
 * Una pantalla del feed (design/oleada-ux.md §Feed de versículos): la foto del
 * devocional a pantalla completa con `imageScrim`, el tema en `overline`, el
 * versículo en serif (más chico cuanto más largo, para que entre sin scroll),
 * la cita, y a la derecha la columna ♥ / Compartir / Leer. Doble toque en
 * cualquier lado = ♥ con un corazón grande que aparece y se va.
 */
function FeedVersePageImpl({ height, insets, item, onRead, onShare, onToggleLike, shareDisabled, showHint }: FeedVersePageProps) {
  const { color } = useTheme();
  const reduceMotion = useReduceMotion();
  const isDoubleTap = useRef(createDoubleTapDetector(tokens.motion.feedDoubleTap)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const text = feedVerseText(item.text);
  const verseType = tokens.type[feedVerseType(text)];

  const showBurst = () => {
    burst.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) {
      Animated.timing(burst, { delay: tokens.motion.feedHeart, duration: 0, toValue: 0, useNativeDriver: true }).start();
      return;
    }
    Animated.sequence([
      Animated.spring(burst, { friction: 4, toValue: 1, useNativeDriver: true }),
      Animated.timing(burst, { duration: tokens.motion.feedHeart, toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const onPress = () => {
    if (!isDoubleTap(Date.now())) return;
    // Doble toque solo da ♥ (como en todos lados); quitarlo es con el botón.
    if (!item.liked) onToggleLike(item.ref);
    showBurst();
  };

  return (
    <Pressable
      accessibilityHint="Tocá dos veces para darle ♥ a este versículo."
      accessibilityLabel={`${text}. ${feedReference(item)}`}
      onPress={onPress}
      style={[styles.page, { backgroundColor: color.surfaceSunk, height }]}
      testID={`feed-page-${item.ref}`}
    >
      <Image accessibilityLabel={item.imageAlt} resizeMode="cover" source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />

      {/* Texto sobre la foto: siempre el `surface` claro, también de noche. */}
      <View style={[styles.body, { paddingBottom: insets.bottom + tokens.space.xxl, paddingTop: insets.top + tokens.size.feedAction }]}>
        <View style={styles.verseBlock}>
          <Text style={[styles.overline, { color: tokens.color.surface }]}>{(item.topic ?? "Versículo").toUpperCase()}</Text>
          <Text
            style={[styles.verse, { color: tokens.color.surface, fontSize: verseType.size, lineHeight: verseType.lineHeight }]}
            testID="feed-verse-text"
          >
            “{text}”
          </Text>
          <Text style={[styles.reference, { color: tokens.color.surface }]}>{feedReference(item)}</Text>
        </View>

        <View style={styles.actions}>
          <FeedAction
            accessibilityLabel={item.liked ? "Quitar ♥" : "Dar ♥"}
            filled={item.liked}
            icon="heart"
            iconColor={item.liked ? color.accent : tokens.color.surface}
            label={formatLikes(item.likes)}
            onPress={() => onToggleLike(item.ref)}
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
          <FeedAction accessibilityLabel="Leer el capítulo" icon="book" label="Leer" onPress={() => onRead(item)} testID="feed-read" />
        </View>
      </View>

      {showHint ? (
        <View pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + tokens.space.xs }]}>
          <Icon color={tokens.color.surface} name="chevronDown" size="sm" />
          <Text style={[styles.hintText, { color: tokens.color.surface }]}>Deslizá para ver más</Text>
        </View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          { opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        ]}
      >
        <View style={styles.burstHeart}>
          <BigHeart color={color.accent} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export const FeedVersePage = memo(FeedVersePageImpl);

function BigHeart({ color }: { color: string }) {
  // El ícono de 24 escalado al tamaño `feedHeart`: mismo trazo del set, relleno.
  return (
    <View style={{ transform: [{ scale: tokens.size.feedHeart / tokens.size.icon.lg }] }}>
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

function FeedAction({ accessibilityLabel, disabled, filled, icon, iconColor, label, onPress, selected, testID }: FeedActionProps) {
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
  actions: { gap: tokens.space.xl, paddingBottom: tokens.space.xl },
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
  hint: { alignItems: "center", alignSelf: "center", gap: tokens.space.xxs, position: "absolute" },
  hintText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  burst: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 },
  burstHeart: { alignItems: "center", height: tokens.size.feedHeart, justifyContent: "center", width: tokens.size.feedHeart },
});
