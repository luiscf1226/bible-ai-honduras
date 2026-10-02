/**
 * Archivos de texto en el teléfono (#160, #182), sin dependencias nativas.
 *
 * La implementación real (`deviceFileStore.ts`) usa `expo-file-system`, que
 * vitest (`edge-runtime`) no puede cargar. Todo lo que guarda o lee archivos
 * recibe un `TextFileStore` por parámetro, así la lógica se prueba con
 * `createMemoryFileStore()`.
 *
 * Las rutas son relativas a la carpeta de la app y usan "/" ("bible/RV1909/juan.json").
 */
export type TextFileStore = {
  read: (path: string) => Promise<string | null>;
  write: (path: string, text: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  /** Borra todo lo que cuelga de una carpeta ("bible/"). */
  removeTree: (prefix: string) => Promise<void>;
};

export function createMemoryFileStore(initial: Record<string, string> = {}): TextFileStore & {
  files: Map<string, string>;
} {
  const files = new Map(Object.entries(initial));
  return {
    files,
    read: async (path) => files.get(path) ?? null,
    write: async (path, text) => {
      files.set(path, text);
    },
    remove: async (path) => {
      files.delete(path);
    },
    removeTree: async (prefix) => {
      const folder = prefix.endsWith("/") ? prefix : `${prefix}/`;
      for (const key of [...files.keys()]) {
        if (key.startsWith(folder)) files.delete(key);
      }
    },
  };
}

/** Lee un JSON guardado; un archivo roto se trata como si no existiera. */
export async function readJson<T>(store: TextFileStore, path: string): Promise<T | null> {
  const raw = await store.read(path).catch(() => null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson(store: TextFileStore, path: string, value: unknown): Promise<void> {
  await store.write(path, JSON.stringify(value));
}
