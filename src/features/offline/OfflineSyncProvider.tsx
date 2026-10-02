import { useConvex, useConvexAuth } from "convex/react";
import type { FunctionReference } from "convex/server";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api } from "../../../convex/_generated/api";
import { deviceFileStore } from "./deviceFileStore";
import { readJson, writeJson } from "./fileStore";
import {
  acknowledge,
  afterFailure,
  EMPTY_QUEUE,
  enqueue,
  forgetPendingNotes,
  restoreQueue,
  syncCallFor,
  type OfflineAction,
  type OfflineQueue,
  type QueuedAction,
  type SyncCall,
} from "./mutationQueue";
import { loadOfflineBible } from "./offlineBible";
import { clearPersistedQueries, usePersistedQuery } from "./usePersistedQuery";
import { useIsOnline } from "./useIsOnline";

/**
 * Cola sin conexión (#182): guarda las acciones en el teléfono y las manda en
 * orden cuando hay red y sesión. La lógica está en `mutationQueue.ts`; acá
 * solo se conecta con React, el disco y Convex.
 */
const QUEUE_PATH = "queue.json";
/** Espera antes de reintentar una acción que falló sin ser un error permanente. */
const RETRY_DELAY_MS = 15_000;

const SYNC_FUNCTIONS: Record<SyncCall["fn"], FunctionReference<"mutation">> = {
  "reading.saveBookmark": api.reading.saveBookmark,
  "reading.removeBookmark": api.reading.removeBookmark,
  "reading.setHighlight": api.reading.setHighlight,
  "reading.clearHighlight": api.reading.clearHighlight,
  "reading.setSeparator": api.reading.setSeparator,
  "reading.clearSeparator": api.reading.clearSeparator,
  "readingPlans.markDayRead": api.readingPlans.markDayRead,
};

type OfflineSyncValue = {
  /** Acciones que todavía no confirmó el servidor, en orden. */
  pending: readonly QueuedAction[];
  online: boolean;
  run: (action: OfflineAction) => void;
  /** Al cerrar sesión o eliminar la cuenta: la cola y la caché son de esa cuenta. */
  clearUserData: () => Promise<void>;
  /** "Borrar mi historial": las notas en cola y en la caché del teléfono también se van. */
  forgetNotes: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  // Lo último visto con señal: así lo encolado sin red ya queda a nombre de la
  // cuenta y no se manda si al volver la red la sesión es de otra persona.
  const currentUser = usePersistedQuery(api.users.current, isAuthenticated ? {} : "skip", "users.current");
  const online = useIsOnline();
  const [queue, setQueue] = useState<OfflineQueue>(EMPTY_QUEUE);
  const [loaded, setLoaded] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const sending = useRef<number | null>(null);
  const retryAt = useRef(0);
  const userId = currentUser?._id ?? null;

  useEffect(() => {
    // La Biblia descargada se anota al arrancar, antes de abrir el lector.
    void loadOfflineBible();
    let alive = true;
    void readJson<unknown>(deviceFileStore, QUEUE_PATH).then((saved) => {
      if (!alive) return;
      // Lo que se encoló antes de terminar de leer el archivo va después.
      setQueue((current) => {
        const restored = restoreQueue(saved);
        if (current.items.length === 0) return restored;
        let merged: OfflineQueue = { ...restored, userId: restored.userId ?? current.userId };
        for (const item of current.items) merged = enqueue(merged, item, item.queuedAt);
        return merged;
      });
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void writeJson(deviceFileStore, QUEUE_PATH, queue).catch(() => undefined);
  }, [loaded, queue]);

  // Una cola de otra cuenta (no debería pasar: se borra al cerrar sesión) no se manda.
  useEffect(() => {
    if (loaded && userId && queue.userId && queue.userId !== userId) {
      setQueue({ ...EMPTY_QUEUE, userId });
    }
  }, [loaded, queue.userId, userId]);

  const head = queue.items[0];
  useEffect(() => {
    if (!loaded || !online || !isAuthenticated || !userId || !head || sending.current !== null) return;
    if (queue.userId && queue.userId !== userId) return;
    const wait = retryAt.current - Date.now();
    if (wait > 0) {
      const timer = setTimeout(() => setRetryTick((tick) => tick + 1), wait);
      return () => clearTimeout(timer);
    }
    const seq = head.seq;
    const call = syncCallFor(head);
    sending.current = seq;
    // Sin red de verdad, Convex no rechaza: guarda la mutación y la manda al
    // reconectar. Por eso se manda de a una: la siguiente sale cuando esta
    // vuelve, y el orden se respeta.
    convex
      .mutation(SYNC_FUNCTIONS[call.fn], call.args)
      .then(() => {
        retryAt.current = 0;
        setQueue((current) => acknowledge(current, seq));
      })
      .catch((error: unknown) => {
        retryAt.current = Date.now() + RETRY_DELAY_MS;
        setQueue((current) => afterFailure(current, seq, error));
      })
      .finally(() => {
        sending.current = null;
        setRetryTick((tick) => tick + 1);
      });
    return undefined;
  }, [convex, head, isAuthenticated, loaded, online, queue.userId, retryTick, userId]);

  const run = useCallback(
    (action: OfflineAction) => {
      setQueue((current) => enqueue({ ...current, userId: current.userId ?? userId }, action, Date.now()));
    },
    [userId],
  );

  const clearUserData = useCallback(async () => {
    setQueue(EMPTY_QUEUE);
    await deviceFileStore.remove(QUEUE_PATH).catch(() => undefined);
    await clearPersistedQueries();
  }, []);

  const forgetNotes = useCallback(async () => {
    setQueue((current) => forgetPendingNotes(current));
    await clearPersistedQueries();
  }, []);

  const value = useMemo(
    () => ({ pending: queue.items, online, run, clearUserData, forgetNotes }),
    [clearUserData, forgetNotes, online, queue.items, run],
  );

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSync(): OfflineSyncValue {
  const value = useContext(OfflineSyncContext);
  if (!value) throw new Error("useOfflineSync necesita <OfflineSyncProvider> (app/_layout.tsx)");
  return value;
}
