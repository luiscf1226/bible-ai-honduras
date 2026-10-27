import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";

import { api } from "../../../convex/_generated/api";
import { track } from "../../lib/telemetry";
import {
  appendFeedPage,
  FEED_PREFETCH_AHEAD,
  newFeedSeed,
  seenRefs,
  settleLike,
  toggleLikeLocally,
  type FeedItem,
} from "./feedLogic";

export type VerseFeedState = {
  items: FeedItem[];
  status: "loading" | "ready" | "error";
  /** Se llama cuando cambia la pantalla visible: pide más antes de llegar al final. */
  onVisible: (index: number) => void;
  toggleLike: (ref: string) => void;
  retry: () => void;
};

/**
 * Feed de versículos: páginas imperativas (no una suscripción) porque cada
 * página depende de lo ya visto. La semilla es una por apertura, así cada vez
 * que se entra el orden es otro. Las fotos de la próxima página se precargan
 * para que el swipe no muestre el fondo vacío.
 */
export function useVerseFeed(): VerseFeedState {
  const convex = useConvex();
  const toggle = useMutation(api.verseFeed.toggleLike);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<VerseFeedState["status"]>("loading");
  const seed = useRef(newFeedSeed());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const page = await convex.query(api.verseFeed.page, { seen: seenRefs(itemsRef.current), seed: seed.current });
      for (const item of page) void Image.prefetch(item.imageUrl).catch(() => undefined);
      setItems((current) => appendFeedPage(current, page));
      setStatus("ready");
    } catch {
      // Sin nada que mostrar es error; con versículos ya cargados, se reintenta al seguir deslizando.
      if (itemsRef.current.length === 0) setStatus("error");
    } finally {
      loading.current = false;
    }
  }, [convex]);

  useEffect(() => {
    track("verse_feed_opened");
    void loadMore();
  }, [loadMore]);

  const onVisible = useCallback(
    (index: number) => {
      if (index >= itemsRef.current.length - FEED_PREFETCH_AHEAD) void loadMore();
    },
    [loadMore],
  );

  const toggleLike = useCallback(
    (ref: string) => {
      const wasLiked = itemsRef.current.find((item) => item.ref === ref)?.liked ?? false;
      setItems((current) => toggleLikeLocally(current, ref));
      if (!wasLiked) track("verse_feed_liked");
      toggle({ ref }).then(
        (result) => setItems((current) => settleLike(current, ref, result)),
        // Si no se pudo guardar, el ♥ vuelve a como estaba.
        () => setItems((current) => toggleLikeLocally(current, ref)),
      );
    },
    [toggle],
  );

  const retry = useCallback(() => {
    setStatus("loading");
    void loadMore();
  }, [loadMore]);

  return { items, onVisible, retry, status, toggleLike };
}
