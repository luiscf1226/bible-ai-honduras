import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { useReduceMotion } from "../hooks/useReduceMotion";
import { tokens } from "../theme/tokens";
import { kenBurnsPath } from "./kenBurns";

type KenBurnsImageProps = {
  uri: string;
  accessibilityLabel: string;
  /** Define hacia dónde pasea (la cita, la escena). */
  seed: string;
  /** Solo se mueve mientras está a la vista; al volver, arranca de nuevo. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Imagen con animación propia: zoom lento con paseo, de ida y vuelta, sin
 * video ni costo (design/oleada-ux.md §Feed de versículos). La imagen se
 * agranda un poco desde el arranque para que el paseo nunca muestre el borde.
 * Con "reducir movimiento" queda quieta.
 */
export function KenBurnsImage({ accessibilityLabel, active = true, seed, style, uri }: KenBurnsImageProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const path = kenBurnsPath(seed);

  useEffect(() => {
    if (reduceMotion || !active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const half = (toValue: number) =>
      Animated.timing(progress, {
        duration: tokens.motion.kenBurns,
        easing: Easing.inOut(Easing.quad),
        toValue,
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([half(1), half(0)]));
    loop.start();
    return () => loop.stop();
  }, [active, progress, reduceMotion]);

  const transform = [
    {
      scale: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [path.toScale - (path.toScale - 1) / 2, path.toScale],
      }),
    },
    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, path.dx] }) },
    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, path.dy] }) },
  ];

  return (
    <View style={[styles.frame, style]}>
      <Animated.Image
        accessibilityLabel={accessibilityLabel}
        resizeMode="cover"
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { transform }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
});
