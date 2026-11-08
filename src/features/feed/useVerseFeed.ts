import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "react-native";

import { api } from "../../../convex/_generated/api";
import { track } from "../../lib/telemetry";
import {
  entryImageUrls,
  FEED_PREFETCH_AHEAD,
  isReel,
  newFeedSeed,
  nextSeenRefs,
  setLikeLocally,
  settleLike,
  type FeedEntry,
  type FeedMode,
} from "./feedLogic";

/** Si una página falla con versículos ya en pantalla, se reintenta sola después de esto. */
const RETRY_MS = 3000;

/** Todas las partes de un reel: el fundido entre partes no tiene que esperar la red. */
function prefetchImages(entry: FeedEntry) {
  for (const url of entryImageUrls(entry)) void Image.prefetch(url).catch(() => undefined);
}

export type VerseFeedState = {
  /** Versículos, y entre ellos historias contadas y personajes (§Reels del feed). */
  items: FeedEntry[];
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
 * que se entra el orden es otro. La foto de la pantalla siguiente (todas las
 * partes, si es un reel) se precarga para que el swipe no muestre el fondo vacío.
 *
 * Lo visto en la vuelta y el largo de la lista viven en refs que se actualizan
 * apenas llega la página (no en el próximo render): si no, un `onVisible` en el
 * medio pediría la misma página otra vez.
 *
 * Cada modo (las pestañas de arriba) tiene su propia semilla y su propio
 * "visto": al volver a una pestaña la lista arranca de nuevo arriba, pero con
 * lo que no se vio todavía en ese modo.
 */
export function useVerseFeed(mode: FeedMode): VerseFeedState {
  const convex = useConvex();
  const saveLike = useMutation(api.verseFeed.setLike);
  const [items, setItems] = useState<FeedEntry[]>([]);
  const [status, setStatus] = useState<VerseFeedState["status"]>("loading");
  const seeds = useRef(new Map<FeedMode, number>());
  const seenByMode = useRef(new Map<FeedMode, string[]>());
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Sube con cada cambio de modo: la respuesta de un pedido del modo anterior se descarta.
  const generation = useRef(0);
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
    const requested = modeRef.current;
    const ticket = generation.current;
    const stale = () => !mounted.current || ticket !== generation.current;
    if (!seeds.current.has(requested)) seeds.current.set(requested, newFeedSeed());
    const seen = seenByMode.current.get(requested) ?? [];
    try {
      const {
        items: page,
        newRound,
        skipped,
      } = await convex.query(api.verseFeed.page, {
        seen,
        seed: seeds.current.get(requested)!,
        mode: requested,
      });
      if (stale()) return;
      // Lo que no tenía texto también cuenta como visto: el próximo pedido ya no lo ofrece.
      seenByMode.current.set(
        requested,
        nextSeenRefs(seenByMode.current.get(requested) ?? [], [...skipped, ...page.map((item) => item.ref)], newRound),
      );
      if (page.length === 0) {
        if (count.current === 0) setStatus("error");
        else scheduleRetry();
        return;
      }
      // Las dos primeras pantallas ya; las demás, de a una cuando la anterior queda a la vista (`onVisible`).
      if (count.current === 0) page.slice(0, 2).forEach(prefetchImages);
      count.current += page.length;
      setItems((current) => [...current, ...page]);
      setStatus("ready");
    } catch {
      if (stale()) return;
      // Sin nada que mostrar es error (con botón para reintentar); con versículos ya
      // cargados, se reintenta solo para que el final de la lista no quede trabado.
      if (count.current === 0) setStatus("error");
      else scheduleRetry();
    } finally {
      if (ticket === generation.current) loading.current = false;
    }
  }, [convex]);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    mounted.current = true;
    track("verse_feed_opened");
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  // Otro modo: la lista arranca vacía y pide su primera página (el pedido en vuelo del anterior se descarta).
  useEffect(() => {
    generation.current += 1;
    loading.current = false;
    count.current = 0;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setItems([]);
    setStatus("loading");
    void loadMore();
  }, [loadMore, mode]);

  const onVisible = useCallback(
    (index: number) => {
      const next = itemsRef.current[index + 1];
      if (next) prefetchImages(next);
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
      if (liked) track(isReel(item) ? "verse_feed_reel_liked" : "verse_feed_liked");
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
