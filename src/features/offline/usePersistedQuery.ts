import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";

import { deviceFileStore } from "./deviceFileStore";
import { readJson, writeJson } from "./fileStore";

/**
 * `useQuery` que recuerda la última respuesta en el teléfono (#160).
 *
 * Convex no guarda nada entre arranques: abierta sin señal, cada `useQuery`
 * queda en `undefined` para siempre. Para lo que el lector y el plan necesitan
 * sin conexión (la cuenta, el separador, los guardados y subrayados del
 * capítulo, el plan) se usa esto: con red devuelve lo del servidor y lo
 * guarda; sin red devuelve lo último que vio.
 *
 * Es dato de la cuenta: `clearPersistedQueries` lo borra al cerrar sesión o
 * eliminar la cuenta.
 */
const CACHE_DIR = "cache";
const memory = new Map<string, unknown>();

function cachePath(key: string): string {
  return `${CACHE_DIR}/${key.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 120)}.json`;
}

export function usePersistedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
  cacheKey: string | null,
): FunctionReturnType<Query> | undefined {
  // El genérico de `useQuery` no se deja reenviar tal cual; el tipo de salida
  // es el mismo.
  const live = useQuery(query as FunctionReference<"query">, args as never) as FunctionReturnType<Query> | undefined;
  const [stored, setStored] = useState<{ key: string; value: unknown } | null>(() =>
    cacheKey && memory.has(cacheKey) ? { key: cacheKey, value: memory.get(cacheKey) } : null,
  );

  useEffect(() => {
    if (!cacheKey) return;
    if (memory.has(cacheKey)) {
      setStored({ key: cacheKey, value: memory.get(cacheKey) });
      return;
    }
    let alive = true;
    void readJson<{ value: unknown }>(deviceFileStore, cachePath(cacheKey)).then((saved) => {
      if (!alive || !saved || !("value" in saved) || memory.has(cacheKey)) return;
      memory.set(cacheKey, saved.value);
      setStored({ key: cacheKey, value: saved.value });
    });
    return () => {
      alive = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    if (!cacheKey || live === undefined) return;
    const previous = memory.get(cacheKey);
    if (memory.has(cacheKey) && JSON.stringify(previous) === JSON.stringify(live)) return;
    memory.set(cacheKey, live);
    void writeJson(deviceFileStore, cachePath(cacheKey), { value: live }).catch(() => undefined);
  }, [cacheKey, live]);

  if (live !== undefined) return live;
  if (!cacheKey || stored?.key !== cacheKey) return undefined;
  return stored.value as FunctionReturnType<Query>;
}

export async function clearPersistedQueries(): Promise<void> {
  memory.clear();
  await deviceFileStore.removeTree(CACHE_DIR).catch(() => undefined);
}
