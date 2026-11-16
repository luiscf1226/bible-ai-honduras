import AsyncStorage from "@react-native-async-storage/async-storage";
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

// El último token que se registró en esta sesión: volver a primer plano no
// lo registra de nuevo.
let registeredToken: string | null = null;

// En disco: el token registrado (para soltarlo al cerrar sesión aunque la app
// se haya reiniciado) y el que quedó sin soltar (sin red al cerrar sesión).
const TOKEN_KEY = "push.token";
const PENDING_KEY = "push.pendingUnregister";
// Sin red, Convex encola la mutación en vez de fallar: nada espera al servidor más que esto.
const SERVER_TIMEOUT_MS = 4000;

// Registrar y soltar van de a uno y en orden: soltar el token de quien cerró
// sesión nunca se cruza con el registro de quien entra.
let queue: Promise<unknown> = Promise.resolve();

function inOrder<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function storage<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

/** Lo que devuelve `call`, o null si falla o tarda más que `SERVER_TIMEOUT_MS`. */
async function within<T>(call: () => Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SERVER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([call(), timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function confirmed(call: () => Promise<unknown>): Promise<boolean> {
  return (await within(() => call().then(() => true))) === true;
}

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
export function registerForPush(register: Register, { ask }: { ask: boolean }): Promise<boolean> {
  return inOrder(() => registerNow(register, ask));
}

async function registerNow(register: Register, ask: boolean): Promise<boolean> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  try {
    if (!(await hasPermission(ask))) return false;
    await ensureChannels();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const expoToken = await within(() => Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined));
    if (!expoToken) return false;
    const token = expoToken.data;
    // Ya registrado en esta sesión: volver a primer plano no escribe de nuevo.
    if (token === registeredToken) return true;
    // Anotado antes de llamar: aunque el registro llegue tarde, cerrar sesión sabe qué soltar.
    await storage(() => AsyncStorage.setItem(TOKEN_KEY, token));
    const platform = Platform.OS;
    if (!(await confirmed(() => register({ token, platform })))) return false;
    registeredToken = token;
    // El token ya es de esta cuenta: lo que quedó sin soltar ya no hace falta.
    if ((await storage(() => AsyncStorage.getItem(PENDING_KEY))) === token) {
      await storage(() => AsyncStorage.removeItem(PENDING_KEY));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Al cerrar sesión: este teléfono deja de recibir los avisos de la cuenta.
 * Nunca bloquea el cierre: sin red, el token queda anotado y se suelta con
 * `retryPendingUnregister` la próxima vez que la app abra sin sesión.
 */
export function unregisterPush(unregister: Unregister): Promise<void> {
  return inOrder(async () => {
    const token = registeredToken ?? (await storage(() => AsyncStorage.getItem(TOKEN_KEY)));
    registeredToken = null;
    if (!token) return;
    // Primero queda anotado como pendiente: si la app se cierra a mitad, se reintenta.
    await storage(() => AsyncStorage.setItem(PENDING_KEY, token));
    await storage(() => AsyncStorage.removeItem(TOKEN_KEY));
    if (await confirmed(() => unregister({ token }))) await storage(() => AsyncStorage.removeItem(PENDING_KEY));
  });
}

/** Sin sesión: suelta el token que quedó pendiente al cerrar sesión sin red. */
export function retryPendingUnregister(unregister: Unregister): Promise<void> {
  return inOrder(async () => {
    const token = await storage(() => AsyncStorage.getItem(PENDING_KEY));
    if (token && (await confirmed(() => unregister({ token })))) await storage(() => AsyncStorage.removeItem(PENDING_KEY));
  });
}
