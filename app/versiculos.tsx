import { useQuery } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { FlatList, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent, type ViewToken } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { LoadingState } from "../src/components/LoadingState";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { buildFeedShareText, type FeedItem } from "../src/features/feed/feedLogic";
import { FeedVersePage } from "../src/features/feed/FeedVersePage";
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
  const { items, onVisible, retry, status, toggleLike } = useVerseFeed();
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;
  const [height, setHeight] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height));

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index === "number") onVisibleRef.current(index);
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
  const onRead = useCallback((item: FeedItem) => openPassage({ book: item.book, chapter: item.chapter, verse: item.verse }), []);

  const renderItem = useCallback(
    ({ index, item }: { index: number; item: FeedItem }) => (
      <FeedVersePage
        height={height}
        insets={{ bottom: insets.bottom, top: insets.top }}
        item={item}
        onRead={onRead}
        onShare={onShare}
        onToggleLike={toggleLike}
        shareDisabled={!referralCode}
        showHint={index === 0}
      />
    ),
    [height, insets.bottom, insets.top, onRead, onShare, referralCode, toggleLike],
  );

  return (
    <View onLayout={onLayout} style={[styles.screen, { backgroundColor: color.bg }]} testID="feed-screen">
      <StatusBar barStyle="light-content" />
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
        <FlatList
          data={items}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ index, length: height, offset: height * index })}
          initialNumToRender={2}
          keyExtractor={(item) => item.ref}
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
      )}
      <ScreenHeader
        accessibilityLabel="Volver al inicio"
        onImage
        style={[styles.back, { top: insets.top + tokens.space.sm }]}
        testID="feed-back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { left: tokens.screenPadding.horizontal, position: "absolute" },
  status: { flex: 1, gap: tokens.space.xl, justifyContent: "center", paddingHorizontal: tokens.screenPadding.horizontal },
  statusText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
});
