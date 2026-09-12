import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { TokenCache } from "@clerk/expo";

import { createSecureTokenCache } from "./secureTokenCache";

/**
 * `AFTER_FIRST_UNLOCK` es lo que usa el `tokenCache` oficial de Clerk
 * (`@clerk/expo/token-cache`). Con el default de expo-secure-store
 * (`WHEN_UNLOCKED`) la key no se puede leer si el proceso arranca con el
 * teléfono bloqueado — y como el `getToken` viejo borraba la key ante cualquier
 * error de lectura, ese caso terminaba destruyendo la sesión. #124.
 *
 * Cambiar la opción no rompe nada ya guardado: `keychainAccessible` solo aplica
 * al escribir; los items viejos se leen igual y se reescriben con la política
 * nueva la próxima vez que Clerk los guarde.
 */
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// SecureStore no existe en web — Clerk usa su propio fallback (localStorage) ahí.
// https://clerk.com/docs/quickstarts/expo#configure-the-token-cache-with-expo
export const clerkTokenCache: TokenCache | undefined =
  Platform.OS === "web"
    ? undefined
    : createSecureTokenCache({
        getItemAsync: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
        setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, secureStoreOptions),
        deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
      });
