import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { Brand } from "./Brand";
import {
  FEELING_GEN_STEPS,
  LOADING_RETRY_AFTER_MS,
  LOADING_STEP_INTERVAL_MS,
  QA_ANSWER_STEPS,
  loadingStepAt,
} from "./loadingSteps";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

export {
  FEELING_GEN_STEPS,
  LOADING_RETRY_AFTER_MS,
  LOADING_STEP_INTERVAL_MS,
  QA_ANSWER_STEPS,
  loadingStepAt,
};

type LoadingStateProps = {
  /** Mensaje fijo cuando no hay `steps`. */
  message?: string;
  /**
   * Líneas que rotan mientras dura la espera. Si el backend no reporta
   * progreso, el índice avanza con un temporizador (ver `loadingSteps.ts`).
   */
  steps?: readonly string[];
  /** Subtítulo opcional (p. ej. "Tomá un respiro mientras tanto."). */
  detail?: string;
  /**
   * `full` — pantallas centradas (Sentir gen, historial, visor).
   * `inline` — fila compacta (Q&A typing, lista, card de home).
   */
  variant?: "full" | "inline";
  /** Logo con pulso suave (pantalla Sentir del prototipo). */
  showBrand?: boolean;
  /** Re-dispara la acción o fuerza un nuevo fetch. */
  onRetry?: () => void;
  /** Override del umbral de retry; por defecto 20 s. */
  retryAfterMs?: number;
  testID?: string;
};

/**
 * Espera informativa compartida (issue #110). Tipografía DM Sans muted /
 * serif en full como el prototipo. Sin skeletons: el contrato visual no
 * define grids de placeholder — solo copy + movimiento sutil.
 */
export function LoadingState({
  detail,
  message,
  onRetry,
  retryAfterMs = LOADING_RETRY_AFTER_MS,
  showBrand = false,
  steps,
  testID = "loading-state",
  variant = "full",
}: LoadingStateProps) {
  const { color } = useTheme();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 400);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!showBrand && variant !== "full") {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: tokens.opacity.pressed,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, showBrand, variant]);

  const label =
    steps && steps.length > 0 ? loadingStepAt(steps, elapsedMs) : (message ?? "Cargando…");
  const showRetry = Boolean(onRetry) && elapsedMs >= retryAfterMs;
  const isInline = variant === "inline";

  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.root, isInline ? styles.inlineRoot : styles.fullRoot]}
      testID={testID}
    >
      {showBrand ? (
        <Animated.View style={{ opacity: pulse }}>
          <Brand size="medium" />
        </Animated.View>
      ) : (
        <ActivityIndicator color={color.accent} />
      )}

      <Animated.Text
        style={[
          isInline ? styles.inlineLabel : styles.fullLabel,
          { color: isInline ? color.inkFaint : color.ink, opacity: showBrand ? 1 : pulse },
        ]}
      >
        {label}
      </Animated.Text>

      {detail && !isInline ? (
        <Text style={[styles.detail, { color: color.inkSoft }]}>{detail}</Text>
      ) : null}

      {showRetry && onRetry ? (
        <View style={styles.retryBlock}>
          <Text style={[styles.retryHint, { color: color.inkSoft }]}>
            Esto está tardando más de lo normal.
          </Text>
          <Pressable
            accessibilityHint="Vuelve a intentar la acción que está en espera."
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retryButton,
              { borderColor: color.borderStrong, backgroundColor: color.surface },
              pressed && { opacity: tokens.opacity.pressed },
            ]}
            testID={`${testID}-retry`}
          >
            <Text style={[styles.retryLabel, { color: color.ink }]}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center" },
  fullRoot: {
    flex: 1,
    gap: tokens.space.xl,
    justifyContent: "center",
    paddingHorizontal: tokens.space.xl,
  },
  inlineRoot: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: tokens.space.sm,
    justifyContent: "flex-start",
    paddingVertical: tokens.space.sm,
  },
  fullLabel: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    maxWidth: tokens.size.logoLarge * 2 + tokens.size.logoMedium,
    textAlign: "center",
  },
  inlineLabel: {
    flexShrink: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  detail: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
  retryBlock: {
    alignItems: "center",
    gap: tokens.space.md,
    marginTop: tokens.space.sm,
    width: "100%",
  },
  retryHint: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.space.xl,
    paddingVertical: tokens.space.md,
  },
  retryLabel: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.label.lineHeight,
  },
});
