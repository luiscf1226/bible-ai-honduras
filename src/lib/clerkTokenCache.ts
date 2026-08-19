import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { TokenCache } from "@clerk/expo";

// SecureStore no existe en web — Clerk usa su propio fallback (localStorage) ahí.
// https://clerk.com/docs/quickstarts/expo#configure-the-token-cache-with-expo
export const clerkTokenCache: TokenCache | undefined =
  Platform.OS === "web"
    ? undefined
    : {
        async getToken(key) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            await SecureStore.deleteItemAsync(key);
            return null;
          }
        },
        async saveToken(key, value) {
          await SecureStore.setItemAsync(key, value);
        },
      };
