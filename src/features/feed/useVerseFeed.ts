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
  // Lo que se pidió por cita mientras hay un pedido en vuelo, y lo último que el servidor confirmó
  // (a eso vuelve el ♥ si un pedido falla).
  const desired = useRef(new Map<string, boolean>());
  const confirmed = useRef(new Map<string, { liked: boolean; likes: number }>());
  const mounted = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const scheduleRetry = () => {
    if (!mounted.current) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => void loadMoreRef.current(), RETRY_MS);
  };

  const loadMore = useCallback(async () => {
    if (loading.current || !mounted.current) return;
    loading.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    try {
      const {
        items: page,
        newRound,
        skipped,
      } = await convex.query(api.verseFeed.page, {
        seen: seen.current,
        seed: seed.current,
      });
      if (!mounted.current) return;
      // Lo que no tenía texto también cuenta como visto: el próximo pedido ya no lo ofrece.
      seen.current = nextSeenRefs(seen.current, [...skipped, ...page.map((item) => item.ref)], newRound);
      if (page.length === 0) {
        if (count.current === 0) setStatus("error");
        else scheduleRetry();
        return;
      }
      count.current += page.length;
      for (const item of page) void Image.prefetch(item.imageUrl).catch(() => undefined);
      setItems((current) => [...current, ...page]);
      setStatus("ready");
    } catch {
      if (!mounted.current) return;
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
    mounted.current = true;
    track("verse_feed_opened");
    void loadMore();
    return () => {
      mounted.current = false;
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
      // El primer pedido en vuelo fija el estado de partida, que es el que vino del servidor.
      if (!confirmed.current.has(ref)) confirmed.current.set(ref, { liked: item.liked, likes: item.likes });
      const request = (likeRequests.current.get(ref) ?? 0) + 1;
      likeRequests.current.set(ref, request);
      setItems((current) => setLikeLocally(current, ref, liked));
      if (liked) track("verse_feed_liked");
      const isLatest = () => likeRequests.current.get(ref) === request;
      // Cuando el último pedido termina, la lista vuelve a mandar (sin estado pedido ni confirmado colgando).
      const settle = (state: { liked: boolean; likes: number }) => {
        desired.current.delete(ref);
        confirmed.current.delete(ref);
        setItems((current) => settleLike(current, ref, state));
      };
      saveLike({ ref, liked }).then(
        (result) => {
          if (isLatest()) settle(result);
          else confirmed.current.set(ref, result);
        },
        // Si no se pudo guardar, el ♥ vuelve a lo último que el servidor confirmó.
        () => {
          const lastConfirmed = confirmed.current.get(ref);
          if (isLatest() && lastConfirmed) settle(lastConfirmed);
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
