import type { TextFileStore } from "./fileStore";

/**
 * En web (solo el harness de QA) `expo-file-system` no tiene archivos: se usa
 * `localStorage` con el mismo prefijo de carpetas. Metro elige este archivo
 * por la extensión `.web.ts`; los builds de iOS y Android no lo incluyen.
 */
const ROOT = "offline/";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const deviceFileStore: TextFileStore = {
  read: async (path) => storage()?.getItem(ROOT + path) ?? null,
  write: async (path, text) => {
    storage()?.setItem(ROOT + path, text);
  },
  remove: async (path) => {
    storage()?.removeItem(ROOT + path);
  },
  removeTree: async (prefix) => {
    const store = storage();
    if (!store) return;
    const folder = ROOT + (prefix.endsWith("/") ? prefix : `${prefix}/`);
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(folder)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  },
};
