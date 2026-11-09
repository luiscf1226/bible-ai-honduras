import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { FRIENDS_CHANNEL } from "../../convex/pushCore";

/**
 * Avisos push (1.0.4): el token de Expo de este teléfono, para que el
 * servidor avise cuando un amigo escribe o pide amistad. Qué dice el aviso y
 * a dónde lleva lo decide el servidor (`convex/pushCore.ts`).
 */

type Register = (args: { token: string; platform: "ios" | "android" }) => Promise<unknown>;
type Unregister = (args: { token: string }) => Promise<unknown>;

// El último token que se registró, para soltarlo al cerrar sesión.
let registeredToken: string | null = null;

async function ensureChannels() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(FRIENDS_CHANNEL, {
    importance: Notifications.AndroidImportance.HIGH,
    name: "Amigos",
  });
}

async function hasPermission(ask: boolean): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!ask || !existing.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

/**
 * Registra este teléfono para avisos. Con `ask`, pide el permiso si todavía
 * se puede; sin `ask`, solo registra si ya estaba dado. Nunca lanza: sin
 * permiso, en un simulador o sin red, simplemente no hay avisos.
 */
export async function registerForPush(register: Register, { ask }: { ask: boolean }): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  try {
    if (!(await hasPermission(ask))) return false;
    await ensureChannels();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    // Ya registrado en esta sesión: volver a primer plano no escribe de nuevo.
    if (token === registeredToken) return true;
    await register({ token, platform: Platform.OS });
    registeredToken = token;
    return true;
  } catch {
    return false;
  }
}

/** Al cerrar sesión: este teléfono deja de recibir los avisos de la cuenta. */
export async function unregisterPush(unregister: Unregister): Promise<void> {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await unregister({ token });
  } catch {
    // Sin red: el token queda hasta que otra cuenta entre en este teléfono.
  }
}
