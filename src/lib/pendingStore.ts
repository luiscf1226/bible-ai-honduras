import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Lo que llega por un link antes de que haya sesión (código de invitación,
 * invitación a un grupo) y tiene que sobrevivir al login y al onboarding.
 * Nunca lanza: sin almacenamiento se pierde el pendiente, nunca la app.
 */

const native = Platform.OS === "ios" || Platform.OS === "android";

// En web no hay SecureStore: el pendiente vive solo en memoria.
const memory = new Map<string, string>();

export async function getPending(key: string): Promise<string | null> {
  if (!native) return memory.get(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPending(key: string, value: string): Promise<void> {
  if (!native) return void memory.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // idem
  }
}

export async function deletePending(key: string): Promise<void> {
  if (!native) return void memory.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // idem
  }
}
