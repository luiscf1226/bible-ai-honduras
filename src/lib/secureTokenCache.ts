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
 *    de tipos, pero Clerk sí lo llama: `nativeClientSync.js` hace
 *    `tokenCache?.clearToken?.(CLERK_CLIENT_JWT_KEY)` cuando el cliente nativo
 *    dice que ya no hay token. Sin implementarlo, el JWT del cliente quedaba
 *    escrito en el keychain después de cerrar sesión.
 */

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
): SecureTokenCache {
  return {
    async getToken(key) {
      try {
        return await storage.getItemAsync(key);
      } catch (error) {
        // NO se borra la key: ver el comentario de arriba. Perder la sesión por
        // un fallo de lectura transitorio es el peor resultado posible.
        onError(`No se pudo leer "${key}" del almacenamiento seguro; se reintenta en el próximo arranque`, error);
        return null;
      }
    },
    async saveToken(key, token) {
      await storage.setItemAsync(key, token);
    },
    async clearToken(key) {
      try {
        await storage.deleteItemAsync(key);
      } catch (error) {
        // Que falle el borrado no debe tumbar un sign-out.
        onError(`No se pudo borrar "${key}" del almacenamiento seguro`, error);
      }
    },
  };
}
