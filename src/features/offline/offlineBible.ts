import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { OfflineChapterVerse } from "../../../convex/offlineBiblePackage";
import { track } from "../../lib/telemetry";
import {
  downloadBible,
  readBibleIndex,
  readLocalChapter,
  removeLocalBible,
  type DownloadProgress,
  type LocalBibleIndex,
  type OfflineManifest,
  type PackageCache,
} from "./bibleDownload";
import { deviceFileStore } from "./deviceFileStore";

/**
 * Estado de la Biblia descargada (#160), compartido por Ajustes y el lector.
 * Vive fuera de React para que la descarga siga si la persona sale de Ajustes.
 */
type OfflineBibleState = {
  loaded: boolean;
  index: LocalBibleIndex | null;
  downloading: DownloadProgress | null;
  failed: boolean;
};

let state: OfflineBibleState = { loaded: false, index: null, downloading: null, failed: false };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function setState(patch: Partial<OfflineBibleState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lee `bible/index.json` una sola vez por arranque. */
export function loadOfflineBible(): Promise<void> {
  loading ??= readBibleIndex(deviceFileStore)
    .catch(() => null)
    .then((index) => setState({ loaded: true, index }));
  return loading;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

export async function startBibleDownload(manifest: OfflineManifest): Promise<void> {
  if (state.downloading || manifest.books.length === 0) return;
  setState({ downloading: { done: 0, total: manifest.books.length, book: null }, failed: false });
  try {
    const index = await downloadBible({
      store: deviceFileStore,
      manifest,
      fetchText,
      onProgress: (progress) => setState({ downloading: progress }),
    });
    setState({ index, downloading: null, failed: false });
    track("bible_downloaded");
  } catch {
    // Lo que se bajó antes del corte queda anotado: la próxima vez sigue de ahí.
    const index = await readBibleIndex(deviceFileStore).catch(() => null);
    setState({ index, downloading: null, failed: true });
  }
}

export async function removeOfflineBible(): Promise<void> {
  await removeLocalBible(deviceFileStore).catch(() => undefined);
  chapterCache.current = null;
  setState({ index: null, failed: false });
}

export function useOfflineBible(): OfflineBibleState {
  useEffect(() => {
    void loadOfflineBible();
  }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

const chapterCache: { current: PackageCache } = { current: null };

/**
 * Capítulo desde el teléfono. `undefined` mientras se averigua; `null` si no
 * está descargado (el lector lo pide al servidor, como antes).
 */
export function useLocalChapter(
  ref: { version: string; book: string; chapter: number } | null,
): OfflineChapterVerse[] | null | undefined {
  const { loaded, index } = useOfflineBible();
  const key = ref ? `${ref.version}|${ref.book}|${ref.chapter}` : null;
  const [result, setResult] = useState<{ key: string | null; verses: OfflineChapterVerse[] | null } | null>(null);
  const latest = useRef(key);
  latest.current = key;

  useEffect(() => {
    if (!loaded || !ref || !key) return;
    let alive = true;
    void readLocalChapter(deviceFileStore, index, ref, chapterCache)
      .catch(() => null)
      .then((verses) => {
        if (alive && latest.current === key) setResult({ key, verses });
      });
    return () => {
      alive = false;
    };
    // `ref` se recrea en cada render; `key` lo resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, index, key]);

  if (!ref) return null;
  if (!loaded) return undefined;
  if (!index || index.version !== ref.version || !index.books[ref.book]) return null;
  return result?.key === key ? result.verses : undefined;
}
