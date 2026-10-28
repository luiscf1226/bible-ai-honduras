import { useQuery } from "convex/react";
import { router, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { LoadingState } from "../src/components/LoadingState";
import { Icon } from "../src/components/Icon";
import { HeaderIconButton, ScreenHeader } from "../src/components/ScreenHeader";
import {
  buildFeedShareText,
  buildReelShareText,
  entryAudioUrl,
  feedItemKey,
  isReel,
  nextScene,
  reelReadingMs,
  reelVoiceTimeoutMs,
  type FeedEntry,
  type FeedItem,
  type FeedReelItem,
  type FeedReelSceneItem,
} from "../src/features/feed/feedLogic";
import { FeedReelPage } from "../src/features/feed/FeedReelPage";
import { FeedVersePage } from "../src/features/feed/FeedVersePage";
import { useFeedVoice } from "../src/features/feed/useFeedVoice";
import { useVerseFeed } from "../src/features/feed/useVerseFeed";
import { useScreenInsets } from "../src/hooks/useKeyboardAvoidance";
import { openPassage } from "../src/lib/openPassage";
import { shareContent } from "../src/lib/share";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/**
 * Feed de versículos (design/oleada-ux.md §Feed de versículos): un versículo
 * por pantalla, swipe vertical sin fin. Se abre desde la tarjeta del inicio.
 * El orden lo arma el servidor con lo que te gusta y lo que más le gusta a la
 * comunidad; compartir pasa por el único dueño del share sheet (regla dura #3).
 * Entre los versículos entran reels (§Reels del feed): historias contadas y
 * personajes, con partes que avanzan solas cuando termina la voz (o, sin voz,
 * con el tiempo de lectura).
 */
export default function VersiculosScreen() {
  const { color } = useTheme();
  const insets = useScreenInsets();
  const { items, onVisible, retry, setLike, status } = useVerseFeed();
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;
  const [height, setHeight] = useState(0);
  // "Leer" abre el lector encima sin desmontar el feed: la barra clara solo mientras se ve el feed.
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
  const onSceneChange = useCallback((scene: number) => setView((current) => ({ ...current, scene })), []);
  // Termina la voz de una parte: una pausa corta y pasa a la siguiente.
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVoiceFinish = useCallback(() => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    const { index, scene } = viewRef.current;
    gapTimer.current = setTimeout(() => advanceFrom(index, scene), tokens.motion.reelSceneGap);
  }, [advanceFrom]);
  const playing = focused && status === "ready";
  const { muted, speaking, toggleMuted } = useFeedVoice(entryAudioUrl(active, sceneIndex), playing, onVoiceFinish);

  // Otra pantalla u otra parte: la pausa pendiente ya no corresponde.
  useEffect(
    () => () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    },
    [activeIndex, sceneIndex],
  );
  // Sin voz (en silencio o sin voz generada), la parte avanza con el tiempo de lectura. Con voz,
  // avanza cuando la voz termina; el tope solo evita que un audio que no carga trabe el reel.
  useEffect(() => {
    if (!playing || !scenes || nextScene({ scenes }, sceneIndex) === null) return;
    const text = scenes[sceneIndex].text;
    const timer = setTimeout(
      () => advanceFrom(activeIndex, sceneIndex),
      speaking ? reelVoiceTimeoutMs(text) : reelReadingMs(text),
    );
    return () => clearTimeout(timer);
  }, [activeIndex, advanceFrom, playing, sceneIndex, scenes, speaking]);

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

  const renderItem = useCallback(
    ({ index, item }: { index: number; item: FeedEntry }) =>
      isReel(item) ? (
        <FeedReelPage
          active={index === activeIndex}
          height={height}
          insetBottom={insets.bottom}
          insetTop={insets.top}
          onRead={onReadScene}
          onSceneChange={onSceneChange}
          onSetLike={setLike}
          onShare={onShareReel}
          onTalk={onTalk}
          reel={item}
          // Solo la pantalla a la vista avanza; las demás esperan en su primera parte.
          sceneIndex={index === activeIndex ? sceneIndex : 0}
          shareDisabled={!referralCode}
        />
      ) : (
        <FeedVersePage
          height={height}
          insetBottom={insets.bottom}
          insetTop={insets.top}
          item={item}
          onRead={onRead}
          onSetLike={setLike}
          onShare={onShare}
          shareDisabled={!referralCode}
          active={index === activeIndex}
          showHint={index === 0}
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
      setLike,
    ],
  );

  return (
    <View onLayout={onLayout} style={[styles.screen, { backgroundColor: color.bg }]} testID="feed-screen">
      {status === "error" ? (
        <View style={[styles.status, { paddingTop: insets.top }]}>
          <Text style={[styles.statusText, { color: color.inkMuted }]}>No pudimos cargar los versículos.</Text>
          <AppButton onPress={retry} testID="feed-retry">
            Intentar de nuevo
          </AppButton>
        </View>
      ) : items.length === 0 || height === 0 ? (
        <View style={[styles.status, { paddingTop: insets.top }]}>
          <LoadingState message="Buscando versículos para vos…" testID="feed-loading" />
        </View>
      ) : (
        <>
          {/* Texto claro en la barra del sistema solo encima de las fotos. */}
          {focused ? <StatusBar barStyle="light-content" /> : null}
          <FlatList
            data={items}
            // La pantalla activa cambia la animación de su fondo y la entrada del versículo; en un reel, la parte.
            extraData={`${activeIndex}:${sceneIndex}`}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({
              index,
              length: height,
              offset: height * index,
            })}
            initialNumToRender={2}
            keyExtractor={feedItemKey}
            maxToRenderPerBatch={3}
            onViewableItemsChanged={onViewableItemsChanged}
            pagingEnabled
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            snapToAlignment="start"
            snapToInterval={height}
            testID="feed-list"
            viewabilityConfig={VIEWABILITY}
            windowSize={5}
          />
        </>
      )}
      <ScreenHeader
        accessibilityLabel="Volver al inicio"
        center={<View pointerEvents="none" />}
        onImage
        pointerEvents="box-none"
        style={[styles.header, { top: insets.top + tokens.space.sm }]}
        testID="feed-back"
        trailing={
          status === "ready" ? (
            <HeaderIconButton
              accessibilityLabel={muted ? "Activar la voz" : "Silenciar la voz"}
              onImage
              onPress={toggleMuted}
              testID="feed-sound"
            >
              <Icon color={color.ink} name={muted ? "soundOff" : "sound"} size="sm" />
            </HeaderIconButton>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Ocupa todo el ancho (‹ a la izquierda, sonido a la derecha) pero no se queda con los toques del medio.
  header: { left: tokens.screenPadding.horizontal, position: "absolute", right: tokens.screenPadding.horizontal },
  status: {
    flex: 1,
    gap: tokens.space.xl,
    justifyContent: "center",
    paddingHorizontal: tokens.screenPadding.horizontal,
  },
  statusText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
});
