import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

/**
 * Piezas que comparten las pantallas del feed (versículo y reel): la columna
 * de acciones y el corazón grande del doble toque (design/oleada-ux.md §Feed
 * de versículos).
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

export const feedStyles = StyleSheet.create({ actions: { gap: tokens.space.xl, paddingBottom: tokens.space.xl } });

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
  burst: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, position: "absolute", right: 0, top: 0 },
  burstHeart: {
    alignItems: "center",
    height: tokens.size.feedHeart,
    justifyContent: "center",
    width: tokens.size.feedHeart,
  },
});
