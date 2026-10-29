import { describe, expect, it, vi } from "vitest";

import { createSecureTokenCache, type SecureStorageLike } from "./secureTokenCache";

function almacenamiento(overrides: Partial<SecureStorageLike> = {}) {
  const store = new Map<string, string>();
  const spies = {
    getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    ...overrides,
  };
  return { spies, store };
}

const silencio = () => {};

describe("createSecureTokenCache", () => {
  it("guarda y devuelve el token", async () => {
    const { spies, store } = almacenamiento();
    const cache = createSecureTokenCache(spies, silencio);

    await cache.saveToken("__clerk_client_jwt", "tok_abc");
    expect(store.get("__clerk_client_jwt")).toBe("tok_abc");
    expect(await cache.getToken("__clerk_client_jwt")).toBe("tok_abc");
  });

  it("devuelve null si la key no existe", async () => {
    const { spies } = almacenamiento();
    expect(await createSecureTokenCache(spies, silencio).getToken("nada")).toBeNull();
  });

  it("un fallo de lectura NO borra el token — la sesión sobrevive (#124)", async () => {
    const { spies, store } = almacenamiento({
      getItemAsync: vi.fn(async () => {
        throw new Error("SecureStore no disponible todavía");
      }),
    });
    store.set("__clerk_client_jwt", "tok_abc");
    const onError = vi.fn();
    const cache = createSecureTokenCache(spies, onError);

    expect(await cache.getToken("__clerk_client_jwt")).toBeNull();
    // Ésta es la regresión: la versión vieja llamaba deleteItemAsync acá.
    expect(spies.deleteItemAsync).not.toHaveBeenCalled();
    expect(store.get("__clerk_client_jwt")).toBe("tok_abc");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("implementa clearToken, que Clerk llama al desconectar el cliente nativo", async () => {
    const { spies, store } = almacenamiento();
    const cache = createSecureTokenCache(spies, silencio);

    await cache.saveToken("__clerk_client_jwt", "tok_abc");
    await cache.clearToken("__clerk_client_jwt");

    expect(spies.deleteItemAsync).toHaveBeenCalledWith("__clerk_client_jwt");
    expect(store.has("__clerk_client_jwt")).toBe(false);
  });

  it("si el borrado falla, no lanza: un sign-out no se rompe por el keychain", async () => {
    const { spies } = almacenamiento({
      deleteItemAsync: vi.fn(async () => {
        throw new Error("keychain bloqueado");
      }),
    });
    const onError = vi.fn();

    await expect(createSecureTokenCache(spies, onError).clearToken("k")).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("un fallo de escritura sí propaga: Clerk tiene que enterarse", async () => {
    const { spies } = almacenamiento({
      setItemAsync: vi.fn(async () => {
        throw new Error("disco lleno");
      }),
    });

    await expect(createSecureTokenCache(spies, silencio).saveToken("k", "v")).rejects.toThrow("disco lleno");
  });

  describe("ninguna llamada colgada traba a Clerk (rechazo 2.1(a) de la 1.0.2)", () => {
    const nunca = () => new Promise<never>(() => {});

    it("leer que nunca contesta devuelve null al vencer el tope", async () => {
      vi.useFakeTimers();
      try {
        const { spies } = almacenamiento({ getItemAsync: vi.fn(nunca) });
        const onError = vi.fn();
        const lectura = createSecureTokenCache(spies, onError, 50).getToken("__clerk_client_jwt");

        await vi.advanceTimersByTimeAsync(50);
        await expect(lectura).resolves.toBeNull();
        expect(onError).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it("guardar que nunca contesta se rinde sin lanzar", async () => {
      vi.useFakeTimers();
      try {
        const { spies } = almacenamiento({ setItemAsync: vi.fn(nunca) });
        const onError = vi.fn();
        const escritura = createSecureTokenCache(spies, onError, 50).saveToken("k", "v");

        await vi.advanceTimersByTimeAsync(50);
        await expect(escritura).resolves.toBeUndefined();
        expect(onError).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });

    it("borrar que nunca contesta se rinde sin lanzar", async () => {
      vi.useFakeTimers();
      try {
        const { spies } = almacenamiento({ deleteItemAsync: vi.fn(nunca) });
        const borrado = createSecureTokenCache(spies, silencio, 50).clearToken("k");

        await vi.advanceTimersByTimeAsync(50);
        await expect(borrado).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("una lectura normal no espera al tope", async () => {
      const { spies, store } = almacenamiento();
      store.set("k", "v");
      expect(await createSecureTokenCache(spies, silencio, 60_000).getToken("k")).toBe("v");
    });
  });
});
