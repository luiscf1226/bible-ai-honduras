import { useQuery } from "convex/react";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from "react-native";

import { api } from "../convex/_generated/api";
import { Icon } from "../src/components/Icon";
import { goBackOrHome } from "../src/components/ScreenHeader";
import {
  buildFeedShareText,
  buildReelShareText,
  entryAudioUrl,
  feedItemKey,
  isReel,
  isSidewaysDrag,
  neighborMode,
  nextScene,
  reelReadingMs,
  reelVoiceTimeoutMs,
  sidewaysSwipe,
  type FeedEntry,
  type FeedItem,
  type FeedMode,
  type FeedPassageTarget,
  type FeedReelItem,
  type FeedReelSceneItem,
} from "../src/features/feed/feedLogic";
import { readFeedHintSeen, writeFeedHintSeen } from "../src/features/feed/feedHintStorage";
import { FeedModeTabs } from "../src/features/feed/FeedModeTabs";
import { FeedSwipeHint } from "../src/features/feed/FeedParts";
import { FeedReelPage } from "../src/features/feed/FeedReelPage";
import { FeedVersePage } from "../src/features/feed/FeedVersePage";
import { useFeedVoice } from "../src/features/feed/useFeedVoice";
import { useVerseFeed } from "../src/features/feed/useVerseFeed";
import { useScreenInsets } from "../src/hooks/useKeyboardAvoidance";
import { useScreenReaderEnabled } from "../src/hooks/useScreenReaderEnabled";
import { openPassage } from "../src/lib/openPassage";
import { shareContent } from "../src/lib/share";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** Cuánto sigue el contenido al dedo al arrastrar de lado: lo justo para que se note que cambia de modo. */
const SIDEWAYS_FOLLOW = 0.35;

const LOADING_MESSAGE: Record<FeedMode, string> = {
  "para-ti": "Buscando versículos para vos…",
  versiculos: "Buscando versículos…",
  historias: "Buscando historias…",
  personajes: "Buscando personajes…",
};

// "Imagen" y "Enviar" del riel se conectan con la imagen del versículo y el chat con amigos
// (otras unidades de la 1.0.3); sin función, el botón no se muestra.
const onImage: ((target: FeedPassageTarget) => void) | undefined = undefined;
const onSend: ((target: FeedPassageTarget) => void) | undefined = undefined;

/**
 * Feed en modo TikTok (design/oleada-ux.md §Feed de versículos, §Reels del
 * feed y §Feed en modo TikTok): pantalla completa sin barra de estado, una
 * pantalla por swipe vertical sin fin, y arriba las pestañas Para ti /
 * Versículos / Historias / Personajes (tocar o deslizar de lado). El orden lo
 * arma el servidor por modo; compartir pasa por el único dueño del share sheet
 * (regla dura #3). Los reels (historias y personajes) tienen partes que
 * avanzan solas con el tiempo de lectura.
 */
export default function VersiculosScreen() {
  const insets = useScreenInsets();
  const [mode, setMode] = useState<FeedMode>("para-ti");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const { items, onVisible, retry, setLike, status } = useVerseFeed(mode);
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;
  const [height, setHeight] = useState(0);
  // "Leer" abre el lector encima sin desmontar el feed: la barra de estado se esconde solo mientras se ve el feed.
  const focused = useIsFocused();
  // La pantalla que se ve (su voz es la que suena) y, en un reel, la parte que se ve. Un solo
  // estado: al cambiar de pantalla, la parte vuelve a 0 en el mismo render, sin un cuadro intermedio.
  const [view, setView] = useState({ index: 0, scene: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const { index: activeIndex, scene: sceneIndex } = view;
  const active = items[activeIndex];
  // Las partes no cambian con un ♥ (el ♥ copia el reel pero no sus partes): los timers no se reinician.
  const scenes = active && isReel(active) ? active.scenes : null;
  // Avanza desde una parte concreta: si mientras tanto la persona cambió de pantalla o de parte, no hace nada.
  const advanceFrom = useCallback(
    (index: number, scene: number) =>
      setView((current) => {
        const next = scenes && nextScene({ scenes }, scene);
        return current.index === index && current.scene === scene && typeof next === "number"
          ? { index, scene: next }
          : current;
      }),
    [scenes],
  );
  // VoiceOver/TalkBack pasa de parte en el reel que tiene el foco: solo cuenta si es la pantalla que se ve.
  const onSceneChange = useCallback(
    (index: number, scene: number) => setView((current) => (current.index === index ? { index, scene } : current)),
    [],
  );
  // Con lector de pantalla no avanza solo (WCAG 2.2.2), ni por tiempo ni al terminar la voz:
  // se pasa de parte con deslizar arriba/abajo.
  const screenReader = useScreenReaderEnabled();
  const screenReaderRef = useRef(screenReader);
  screenReaderRef.current = screenReader;
  // Termina la voz de una parte: una pausa corta y pasa a la siguiente.
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVoiceFinish = useCallback(() => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    if (screenReaderRef.current) return;
    const { index, scene } = viewRef.current;
    gapTimer.current = setTimeout(() => advanceFrom(index, scene), tokens.motion.reelSceneGap);
  }, [advanceFrom]);
  const playing = focused && status === "ready";
  const { available: voiceAvailable, muted, speaking, toggleMuted } = useFeedVoice(entryAudioUrl(active, sceneIndex), playing, onVoiceFinish);
  const autoAdvance = playing && !screenReader;

  // Otra pantalla, otra parte o el feed fuera de foco ("Leer", "Conversar"): la pausa pendiente ya no corresponde.
  useEffect(
    () => () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    },
    [activeIndex, playing, sceneIndex],
  );
  // Sin voz (en silencio o sin voz generada), la parte avanza con el tiempo de lectura. Con voz,
  // avanza cuando la voz termina; el tope solo evita que un audio que no carga trabe el reel.
  useEffect(() => {
    if (!autoAdvance || !scenes || nextScene({ scenes }, sceneIndex) === null) return;
    const text = scenes[sceneIndex].text;
    const timer = setTimeout(
      () => advanceFrom(activeIndex, sceneIndex),
      speaking ? reelVoiceTimeoutMs(text) : reelReadingMs(text),
    );
    return () => clearTimeout(timer);
  }, [activeIndex, advanceFrom, autoAdvance, sceneIndex, scenes, speaking]);
  // El tramo de la barra se llena en lo que dura la parte; con voz, la parte dura lo que la voz.
  const sceneMs = autoAdvance && scenes && !speaking ? reelReadingMs(scenes[sceneIndex].text) : null;

  // Pista de la primera vez (se recuerda en el teléfono): se va al deslizar, al cambiar de modo o sola.
  // "gone" = se mostró y se está yendo (fundido); "done" = ya se había visto antes.
  const [hint, setHint] = useState<"unknown" | "show" | "gone" | "done">("unknown");
  useEffect(() => {
    let current = true;
    void readFeedHintSeen().then((seen) => {
      if (current) setHint((state) => (state === "unknown" ? (seen ? "done" : "show") : state));
    });
    return () => {
      current = false;
    };
  }, []);
  const showHint = hint === "show" && status === "ready" && !screenReader;
  useEffect(() => {
    if (!showHint) return;
    void writeFeedHintSeen();
    const timer = setTimeout(() => setHint("gone"), tokens.motion.feedHint);
    return () => clearTimeout(timer);
  }, [showHint]);
  useEffect(() => {
    if (activeIndex > 0) setHint((state) => (state === "show" ? "gone" : state));
  }, [activeIndex]);

  // Otro modo: la lista nueva arranca arriba (el hook trae su primera página con lo ya visto en ese modo).
  const changeMode = useCallback((next: FeedMode) => {
    if (next === modeRef.current) return;
    setMode(next);
    setView({ index: 0, scene: 0 });
    setHint((state) => (state === "show" ? "gone" : state));
  }, []);
  const changeModeRef = useRef(changeMode);
  changeModeRef.current = changeMode;

  // Deslizar de lado cambia de modo. Solo se queda con arrastres claramente horizontales:
  // el swipe vertical, los toques y el doble toque siguen siendo del feed.
  const drag = useRef(new Animated.Value(0)).current;
  const settle = useCallback(
    () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    [drag],
  );
  const sideways = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        isSidewaysDrag(gesture.dx, gesture.dy, tokens.motion.feedModeSwipe),
      onPanResponderMove: (_, gesture) => drag.setValue(gesture.dx * SIDEWAYS_FOLLOW),
      onPanResponderRelease: (_, gesture) => {
        const direction = sidewaysSwipe(gesture.dx, gesture.dy, tokens.motion.feedModeSwipe);
        if (direction) changeModeRef.current(neighborMode(modeRef.current, direction));
        settle();
      },
      onPanResponderTerminate: () => settle(),
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index !== "number") return;
    setView((current) => (current.index === index ? current : { index, scene: 0 }));
    onVisibleRef.current(index);
  }).current;
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  const onShare = useCallback(
    (item: FeedItem) => {
      if (!referralCode) return;
      void shareContent({ referralCode, text: buildFeedShareText(item) });
    },
    [referralCode],
  );
  const onShareReel = useCallback(
    (reel: FeedReelItem, index: number) => {
      if (!referralCode) return;
      void shareContent({ referralCode, text: buildReelShareText(reel, index) });
    },
    [referralCode],
  );
  const onReadScene = useCallback(
    (scene: FeedReelSceneItem) =>
      openPassage({
        book: scene.book,
        chapter: scene.chapter,
        ...(scene.verse === null ? {} : { verse: scene.verse }),
      }),
    [],
  );
  const onTalk = useCallback((slug: string) => router.push(`/voces/${slug}`), []);
  const onRead = useCallback(
    (item: FeedItem) =>
      openPassage({
        book: item.book,
        chapter: item.chapter,
        verse: item.verse,
      }),
    [],
  );

  // Las pantallas son `memo`: al cambiar la que se ve solo cambian las props de la que entra y la que sale.
  const renderItem = useCallback(
    ({ index, item }: { index: number; item: FeedEntry }) =>
      isReel(item) ? (
        <FeedReelPage
          active={index === activeIndex}
          height={height}
          insetBottom={insets.bottom}
          insetTop={insets.top}
          onImage={onImage}
          onRead={onReadScene}
          onSceneChange={onSceneChange}
          onSend={onSend}
          onSetLike={setLike}
          onShare={onShareReel}
          onTalk={onTalk}
          pageIndex={index}
          reel={item}
          // Solo la pantalla a la vista avanza; las demás esperan en su primera parte.
          sceneIndex={index === activeIndex ? sceneIndex : 0}
          sceneMs={index === activeIndex ? sceneMs : null}
          shareDisabled={!referralCode}
        />
      ) : (
        <FeedVersePage
          active={index === activeIndex}
          height={height}
          insetBottom={insets.bottom}
          insetTop={insets.top}
          item={item}
          onImage={onImage}
          onRead={onRead}
          onSend={onSend}
          onSetLike={setLike}
          onShare={onShare}
          shareDisabled={!referralCode}
        />
      ),
    [
      activeIndex,
      height,
      insets.bottom,
      insets.top,
      onRead,
      onReadScene,
      onShare,
      onSceneChange,
      onShareReel,
      onTalk,
      referralCode,
      sceneIndex,
      sceneMs,
      setLike,
    ],
  );

  return (
    <View
      onLayout={onLayout}
      style={[styles.screen, { backgroundColor: tokens.night.color.bg }]}
      testID="feed-screen"
      {...sideways.panHandlers}
    >
      {/* Inmersivo, como un video: sin barra de estado mientras se ve el feed. */}
      {focused ? <StatusBar barStyle="light-content" hidden showHideTransition="fade" /> : null}
      <Animated.View style={[styles.content, { transform: [{ translateX: drag }] }]}>
        {status === "error" ? (
          <View style={[styles.status, { paddingTop: insets.top + tokens.size.feedAction }]}>
            <Text style={[styles.statusText, { color: tokens.color.surface }]}>No pudimos cargar el feed.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              testID="feed-retry"
            >
              <View style={[StyleSheet.absoluteFill, styles.retryFill, { backgroundColor: tokens.color.surface }]} />
              <Icon color={tokens.color.surface} name="refresh" size="sm" />
              <Text style={[styles.retryLabel, { color: tokens.color.surface }]}>Intentar de nuevo</Text>
            </Pressable>
          </View>
        ) : items.length === 0 || height === 0 ? (
          <View style={[styles.status, { paddingTop: insets.top + tokens.size.feedAction }]} testID="feed-loading">
            <ActivityIndicator color={tokens.color.surface} />
            <Text style={[styles.statusText, { color: tokens.color.surface }]}>{LOADING_MESSAGE[mode]}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            // La pantalla activa cambia la animación de su fondo y la entrada del versículo; en un reel, la parte.
            extraData={`${activeIndex}:${sceneIndex}:${sceneMs}`}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              index,
              length: height,
              offset: height * index,
            })}
            // Cada pantalla es una imagen a pantalla completa: se arma la que se ve y sus vecinas, nada más.
            initialNumToRender={1}
            key={mode}
            keyExtractor={feedItemKey}
            maxToRenderPerBatch={2}
            onViewableItemsChanged={onViewableItemsChanged}
            pagingEnabled
            removeClippedSubviews
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={height}
            testID="feed-list"
            viewabilityConfig={VIEWABILITY}
            windowSize={3}
          />
        )}
      </Animated.View>

      {hint === "show" || hint === "gone" ? (
        <FeedSwipeHint bottom={insets.bottom + tokens.size.feedHeart} visible={showHint} />
      ) : null}

      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + tokens.space.sm }]}>
        <Pressable
          accessibilityLabel="Cerrar el feed"
          accessibilityRole="button"
          hitSlop={tokens.space.sm}
          onPress={goBackOrHome}
          style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
          testID="feed-back"
        >
          <Icon color={tokens.color.surface} name="close" size="md" />
        </Pressable>
        <FeedModeTabs mode={mode} onChange={changeMode} />
        {status === "ready" && voiceAvailable ? (
          <Pressable
            accessibilityLabel={muted ? "Activar la voz" : "Silenciar la voz"}
            accessibilityRole="button"
            hitSlop={tokens.space.sm}
            onPress={toggleMuted}
            style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
            testID="feed-sound"
          >
            <Icon color={tokens.color.surface} name={muted ? "soundOff" : "sound"} size="md" />
          </Pressable>
        ) : (
          // Del mismo ancho que el ✕, para que las pestañas queden centradas en la pantalla.
          <View style={styles.topButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1 },
  // Ocupa todo el ancho (✕ a la izquierda, pestañas al centro) pero no se queda con los toques del medio.
  top: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.space.xs,
    left: tokens.screenPadding.horizontal,
    position: "absolute",
    right: tokens.screenPadding.horizontal,
  },
  topButton: {
    alignItems: "center",
    height: tokens.size.backButton,
    justifyContent: "center",
    width: tokens.size.backButton,
  },
  pressed: { opacity: tokens.opacity.pressed },
  status: {
    alignItems: "center",
    flex: 1,
    gap: tokens.space.xl,
    justifyContent: "center",
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  statusText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    opacity: tokens.opacity.imageMuted,
    textAlign: "center",
  },
  retry: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    flexDirection: "row",
    gap: tokens.space.xs,
    overflow: "hidden",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  retryFill: { opacity: tokens.opacity.feedActionFill },
  retryLabel: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.label.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
});
