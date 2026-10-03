import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../convex/bibleVersions";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { goBackOrHome, ScreenHeader } from "../src/components/ScreenHeader";
import { useTodayDevotional } from "../src/features/home/useTodayDevotional";
import {
  choosePauseVerse,
  pausePhase,
  pauseProgress,
  pauseRemaining,
  readPauseParams,
} from "../src/features/pause/pause";
import { useReduceMotion } from "../src/hooks/useReduceMotion";
import { openPassage } from "../src/lib/openPassage";
import { track } from "../src/lib/telemetry";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

const KEEP_AWAKE_TAG = "minuto-de-pausa";
// Con "reducir movimiento" la línea no se desliza: avanza a saltos de un segundo.
const TICK_MS = 1000;

/**
 * Un minuto de pausa (#203, design/oleada-ux.md §Pausa): un versículo que
 * aparece despacio, un minuto de silencio con una línea muy fina que marca el
 * tiempo, y un "Amén" con dos salidas. Sin racha, sin conteo, sin sonido; no
 * guarda nada en el servidor. El fondo es `color.bg`, que ya trae la temporada
 * (#199) desde el `ThemeProvider`.
 */
export default function PausaScreen() {
  const { color } = useTheme();
  const reduceMotion = useReduceMotion();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  const fromRoute = useMemo(
    () => readPauseParams({ book: params.book, chapter: params.chapter, verse: params.verse }),
    [params.book, params.chapter, params.verse],
  );

  // Sin versículo de Sentir, el del día. La lectura del devocional es una sola
  // query; si vino uno de Sentir, su resultado simplemente no se usa.
  const { retry, state } = useTodayDevotional();
  const todayRef = state.status === "ready" ? state.devotional.verseRef : null;
  const passage = useMemo(() => choosePauseVerse(fromRoute, todayRef), [fromRoute, todayRef]);
  const cited = useQuery(api.rag.verses.citedForUser, passage ?? "skip");
  const failed = !fromRoute && (state.status === "error" || (state.status === "ready" && !passage));

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const phase = pausePhase(startedAt, now);

  const verseOpacity = useRef(new Animated.Value(0)).current;
  const closeOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const completedTracked = useRef(false);

  // El minuto empieza cuando el versículo ya está en pantalla (con o sin texto
  // del corpus: sin corpus para la versión se muestra la cita sola).
  const verseReady = passage !== null && cited !== undefined;
  useEffect(() => {
    if (!verseReady || startedAt !== null) return;
    const start = Date.now();
    setNow(start);
    setStartedAt(start);
  }, [verseReady, startedAt]);

  // Aparición del versículo: lenta, o de golpe con "reducir movimiento".
  useEffect(() => {
    if (startedAt === null) return;
    if (reduceMotion) {
      verseOpacity.setValue(1);
      return;
    }
    const fade = Animated.timing(verseOpacity, {
      delay: tokens.motion.verseDelay,
      duration: tokens.motion.verseFadeIn,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [startedAt, reduceMotion, verseOpacity]);

  // Reloj del minuto. Se mide contra `Date.now()`, no sumando ticks, para que
  // no se atrase si el teléfono va lento o la app pasa a segundo plano.
  useEffect(() => {
    if (startedAt === null || phase === "done") return;
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    const finish = setTimeout(() => setNow(Date.now()), pauseRemaining(startedAt, Date.now()));
    return () => {
      clearInterval(interval);
      clearTimeout(finish);
    };
  }, [startedAt, phase]);

  // Línea del tiempo: se desliza lineal en un solo trazo; con "reducir
  // movimiento" sigue al reloj a saltos, sin animación.
  useEffect(() => {
    if (startedAt === null) return;
    const current = pauseProgress(startedAt, Date.now());
    progress.setValue(current);
    if (reduceMotion) return;
    const slide = Animated.timing(progress, {
      duration: pauseRemaining(startedAt, Date.now()),
      easing: Easing.linear,
      toValue: 1,
      useNativeDriver: true,
    });
    slide.start();
    return () => slide.stop();
  }, [startedAt, reduceMotion, progress]);

  useEffect(() => {
    if (reduceMotion && startedAt !== null) progress.setValue(pauseProgress(startedAt, now));
  }, [reduceMotion, startedAt, now, progress]);

  // La pantalla no se apaga durante el minuto; al terminar o al salir vuelve a lo normal.
  useEffect(() => {
    if (phase !== "running") return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [phase]);

  // Cierre: "Amén" y las dos salidas, sin festejo. Telemetría sin contenido.
  useEffect(() => {
    if (phase !== "done") return;
    if (!completedTracked.current) {
      completedTracked.current = true;
      track("pause_completed");
    }
    if (reduceMotion) {
      closeOpacity.setValue(1);
      return;
    }
    const fade = Animated.timing(closeOpacity, {
      duration: tokens.motion.closeFadeIn,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [phase, reduceMotion, closeOpacity]);

  const verseText = cited?.verse?.text ?? null;
  const version = cited?.version ?? DEFAULT_BIBLE_VERSION;
  const citation = passage ? `${passage.book} ${passage.chapter}:${passage.verse} · ${version}` : "";

  return (
    <AppScreen contentStyle={styles.screen} style={{ backgroundColor: color.bg }}>
      <ScreenHeader
        accessibilityLabel="Salir de la pausa"
        center={<Text style={[styles.overline, { color: color.inkSoft }]}>UN MINUTO DE PAUSA</Text>}
        testID="pausa-exit"
      />

      {/* Scroll solo como respaldo para un versículo muy largo en un teléfono chico. */}
      <ScrollView
        contentContainerStyle={styles.center}
        showsVerticalScrollIndicator={false}
        style={styles.centerScroll}
        testID="pausa-screen"
      >
        {failed ? (
          <View style={styles.status} testID="pausa-error">
            <Text style={[styles.statusTitle, { color: color.ink }]}>No pudimos traer el versículo</Text>
            <Text style={[styles.statusText, { color: color.inkMuted }]}>Revisá tu conexión y probá de nuevo.</Text>
            <AppButton icon="refresh" onPress={retry} testID="pausa-retry" variant="secondary">
              Intentar de nuevo
            </AppButton>
          </View>
        ) : startedAt !== null && passage ? (
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[styles.verseBlock, { opacity: verseOpacity }]}
          >
            <Text style={[styles.verse, { color: color.ink }]} testID="pausa-verse">
              {verseText ? `“${verseText}”` : `${passage.book} ${passage.chapter}:${passage.verse}`}
            </Text>
            {verseText ? (
              <Text style={[styles.citation, { color: color.inkMuted }]} testID="pausa-citation">
                {citation}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* El pie siempre ocupa su lugar (el cierre existe invisible durante el
          minuto) para que el versículo no salte cuando llega el "Amén". */}
      <View style={styles.footer}>
        <Animated.View
          accessibilityElementsHidden={phase !== "done"}
          importantForAccessibility={phase === "done" ? "auto" : "no-hide-descendants"}
          pointerEvents={phase === "done" ? "auto" : "none"}
          style={[styles.close, { opacity: closeOpacity }]}
          testID={phase === "done" ? "pausa-done" : undefined}
        >
          <Text accessibilityRole="header" style={[styles.amen, { color: color.accentDeep }]}>
            Amén
          </Text>
          <AppButton
            disabled={!passage}
            icon="book"
            onPress={() => {
              if (passage) openPassage(passage);
            }}
            testID="pausa-read-chapter"
          >
            Leer el capítulo
          </AppButton>
          <AppButton onPress={goBackOrHome} testID="pausa-back" variant="quiet">
            Volver
          </AppButton>
        </Animated.View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          style={[styles.track, { backgroundColor: phase === "running" ? color.border : "transparent" }]}
          testID="pausa-progress"
        >
          {phase === "running" ? (
            <Animated.View
              style={[
                styles.fill,
                {
                  backgroundColor: color.accent,
                  transform: [
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth, 0] }) },
                  ],
                  width: trackWidth,
                },
              ]}
            />
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: tokens.space.xl },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  centerScroll: { flex: 1 },
  center: { flexGrow: 1, justifyContent: "center", paddingHorizontal: tokens.space.md },
  verseBlock: { alignItems: "center", gap: tokens.space.lg },
  verse: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verseHero.size,
    lineHeight: tokens.type.verseHero.lineHeight,
    textAlign: "center",
  },
  citation: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  status: { alignItems: "stretch", gap: tokens.space.md },
  statusTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center",
  },
  statusText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginBottom: tokens.space.md,
    textAlign: "center",
  },
  footer: { gap: tokens.space.xl, paddingBottom: tokens.space.md },
  track: { borderRadius: tokens.radius.pill, height: tokens.size.pauseLine, overflow: "hidden" },
  fill: { borderRadius: tokens.radius.pill, height: tokens.size.pauseLine },
  close: { gap: tokens.space.md },
  amen: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginBottom: tokens.space.sm,
    textAlign: "center",
  },
});
