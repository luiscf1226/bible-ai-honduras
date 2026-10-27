import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";

import { api } from "../../../convex/_generated/api";
import { track } from "../../lib/telemetry";
import { FEED_PREFETCH_AHEAD, newFeedSeed, nextSeenRefs, setLikeLocally, settleLike, type FeedItem } from "./feedLogic";

/** Si una página falla con versículos ya en pantalla, se reintenta sola después de esto. */
const RETRY_MS = 3000;

export type VerseFeedState = {
  items: FeedItem[];
  status: "loading" | "ready" | "error";
  /** Se llama cuando cambia la pantalla visible: pide más antes de llegar al final. */
  onVisible: (index: number) => void;
  /** Deja el ♥ de la cita como se pide (el doble toque siempre pide `true`). */
  setLike: (ref: string, liked: boolean) => void;
  retry: () => void;
};

/**
 * Feed de versículos: páginas imperativas (no una suscripción) porque cada
 * página depende de lo ya visto. La semilla es una por apertura, así cada vez
 * que se entra el orden es otro. Las fotos de la próxima página se precargan
 * para que el swipe no muestre el fondo vacío.
 *
 * Lo visto en la vuelta y el largo de la lista viven en refs que se actualizan
 * apenas llega la página (no en el próximo render): si no, un `onVisible` en el
 * medio pediría la misma página otra vez.
 */
export function useVerseFeed(): VerseFeedState {
  const convex = useConvex();
  const saveLike = useMutation(api.verseFeed.setLike);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<VerseFeedState["status"]>("loading");
  const seed = useRef(newFeedSeed());
  const seen = useRef<string[]>([]);
  const count = useRef(0);
  const loading = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Por cita, el número del último pedido de ♥: una respuesta vieja no pisa a una nueva.
  const likeRequests = useRef(new Map<string, number>());
  const desired = useRef(new Map<string, boolean>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const scheduleRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => void loadMoreRef.current(), RETRY_MS);
  };

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const { items: page, newRound } = await convex.query(api.verseFeed.page, {
        seen: seen.current,
        seed: seed.current,
      });
      if (page.length === 0) {
        if (count.current === 0) setStatus("error");
        else scheduleRetry();
        return;
      }
      seen.current = nextSeenRefs(
        seen.current,
        page.map((item) => item.ref),
        newRound,
      );
      count.current += page.length;
      for (const item of page) void Image.prefetch(item.imageUrl).catch(() => undefined);
      setItems((current) => [...current, ...page]);
      setStatus("ready");
    } catch {
      // Sin nada que mostrar es error (con botón para reintentar); con versículos ya
      // cargados, se reintenta solo para que el final de la lista no quede trabado.
      if (count.current === 0) setStatus("error");
      else scheduleRetry();
    } finally {
      loading.current = false;
    }
  }, [convex]);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    track("verse_feed_opened");
    void loadMore();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [loadMore]);

  const onVisible = useCallback(
    (index: number) => {
      if (index >= count.current - FEED_PREFETCH_AHEAD) void loadMore();
    },
    [loadMore],
  );

  const setLike = useCallback(
    (ref: string, liked: boolean) => {
      const item = itemsRef.current.find((entry) => entry.ref === ref);
      if (!item) return;
      // Lo último que se pidió manda (la lista en el ref recién se actualiza en el próximo render).
      const wasLiked = desired.current.get(ref) ?? item.liked;
      if (wasLiked === liked) return;
      desired.current.set(ref, liked);
      const before = { liked: wasLiked, likes: item.likes };
      const request = (likeRequests.current.get(ref) ?? 0) + 1;
      likeRequests.current.set(ref, request);
      setItems((current) => setLikeLocally(current, ref, liked));
      if (liked) track("verse_feed_liked");
      const isLatest = () => likeRequests.current.get(ref) === request;
      saveLike({ ref, liked }).then(
        (result) => {
          if (isLatest()) setItems((current) => settleLike(current, ref, result));
        },
        // Si no se pudo guardar, el ♥ vuelve a como estaba antes del toque.
        () => {
          if (!isLatest()) return;
          desired.current.set(ref, before.liked);
          setItems((current) => settleLike(current, ref, before));
        },
      );
    },
    [saveLike],
  );
  const retry = useCallback(() => {
    setStatus("loading");
    void loadMore();
  }, [loadMore]);

  return { items, onVisible, retry, setLike, status };
}
