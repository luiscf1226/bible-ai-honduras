import { useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { LoadingState } from "../src/components/LoadingState";
import { Icon } from "../src/components/Icon";
import { HeaderIconButton, ScreenHeader } from "../src/components/ScreenHeader";
import { buildFeedShareText, feedItemKey, type FeedItem } from "../src/features/feed/feedLogic";
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
  // La pantalla que se ve: su voz es la que suena.
  const [activeIndex, setActiveIndex] = useState(0);
  const { muted, toggleMuted } = useFeedVoice(items[activeIndex]?.audioUrl ?? null, focused && status === "ready");

  const onLayout = (event: LayoutChangeEvent) => setHeight(event.nativeEvent.layout.height);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index !== "number") return;
    setActiveIndex(index);
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
    ({ index, item }: { index: number; item: FeedItem }) => (
      <FeedVersePage
        height={height}
        insetBottom={insets.bottom}
        insetTop={insets.top}
        item={item}
        onRead={onRead}
        onSetLike={setLike}
        onShare={onShare}
        shareDisabled={!referralCode}
        showHint={index === 0}
      />
    ),
    [height, insets.bottom, insets.top, onRead, onShare, referralCode, setLike],
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
        center={<View />}
        onImage
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
