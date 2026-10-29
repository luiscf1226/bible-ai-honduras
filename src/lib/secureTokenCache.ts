import { timedOut, withTimeout } from "./withTimeout";

/**
 * Fábrica del token cache de Clerk, sin dependencias nativas — issue #124.
 *
 * La implementación real (`clerkTokenCache.ts`) importa `react-native` y
 * `expo-secure-store`, y el entorno de vitest (`edge-runtime`) no puede
 * resolverlos. El almacenamiento entra como parámetro para que la política
 * —qué se hace cuando SecureStore falla— sí se pueda probar.
 *
 * ## Qué se arregló acá
 *
 * La versión anterior era la de la guía de Clerk, con dos diferencias respecto
 * del `tokenCache` oficial de `@clerk/expo/token-cache` que importan de verdad:
 *
 * 1. **`getToken` borraba la key en el `catch`.** Un fallo transitorio de
 *    SecureStore (primer arranque tras instalar, keychain no disponible
 *    todavía) destruía el token en vez de reintentar en el próximo arranque:
 *    una sesión perfectamente válida se perdía para siempre. Acá el `catch`
 *    devuelve `null` y deja el dato donde está. Si el token realmente es
 *    inválido, Clerk pide uno nuevo; si el fallo era transitorio, el próximo
 *    arranque lo lee bien.
 * 2. **No implementaba `clearToken`.** Es opcional en la interfaz `TokenCache`
 *    de `@clerk/expo@4.5.0` (`dist/cache/types.d.ts`), así que no era un error
 *    de tipos, pero Clerk sí lo llama (al cambiar la publishable key, y
 *    `nativeClientSync.js` cuando el cliente nativo dice que ya no hay token).
 *    Sin implementarlo, el JWT del cliente quedaba escrito en el keychain.
 *
 * ## Ninguna llamada al keychain puede colgar el arranque (rechazo 2.1(a) de la 1.0.2)
 *
 * Clerk espera este cache antes de cada request (`getToken`) y después de cada
 * respuesta (`saveToken`). Si una llamada a SecureStore nunca contesta, Clerk
 * no termina de cargar y la app se queda en blanco para siempre. Por eso cada
 * llamada tiene un tope de `timeoutMs`; escribir o borrar se rinden sin trabar
 * a Clerk.
 *
 * Una lectura que falla o vence devuelve **lo último que se leyó o guardó en
 * esta sesión**, no `null`: como Clerk lee antes de cada request, un `null` a
 * mitad de sesión mandaría el request sin el JWT del cliente y Clerk cerraría
 * la sesión. Solo sin nada conocido (la primera lectura al abrir) se sigue sin
 * token.
 */

/** Tope por llamada a SecureStore. Leer el keychain tarda milisegundos. */
export const SECURE_STORE_TIMEOUT_MS = 3_000;

/** Lo que Clerk necesita de un almacenamiento seguro. */
export type SecureStorageLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** La forma de `TokenCache` de `@clerk/expo`, repetida acá para no importar RN. */
export type SecureTokenCache = {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken: (key: string) => Promise<void>;
};

export function createSecureTokenCache(
  storage: SecureStorageLike,
  onError: (message: string, error: unknown) => void = console.error,
  timeoutMs: number = SECURE_STORE_TIMEOUT_MS,
): SecureTokenCache {
  // Lo último que se leyó o guardó por key en esta sesión (ver arriba).
  const known = new Map<string, string | null>();

  return {
    async getToken(key) {
      try {
        const value = await withTimeout(storage.getItemAsync(key), timeoutMs);
        if (value === timedOut) {
          onError(`Leer "${key}" del almacenamiento seguro tardó más de ${timeoutMs} ms; se usa lo último conocido`, null);
          return known.get(key) ?? null;
        }
        known.set(key, value);
        return value;
      } catch (error) {
        // NO se borra la key: ver el comentario de arriba. Perder la sesión por
        // un fallo de lectura transitorio es el peor resultado posible.
        onError(`No se pudo leer "${key}" del almacenamiento seguro; se usa lo último conocido`, error);
        return known.get(key) ?? null;
      }
    },
    async saveToken(key, token) {
      known.set(key, token);
      if ((await withTimeout(storage.setItemAsync(key, token), timeoutMs)) === timedOut) {
        onError(`Guardar "${key}" en el almacenamiento seguro tardó más de ${timeoutMs} ms; se sigue sin esperar`, null);
      }
    },
    async clearToken(key) {
      known.delete(key);
      try {
        if ((await withTimeout(storage.deleteItemAsync(key), timeoutMs)) === timedOut) {
          onError(`Borrar "${key}" del almacenamiento seguro tardó más de ${timeoutMs} ms; se sigue sin esperar`, null);
        }
      } catch (error) {
        // Que falle el borrado no debe tumbar un sign-out.
        onError(`No se pudo borrar "${key}" del almacenamiento seguro`, error);
      }
    },
  };
}
