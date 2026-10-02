import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import {
  LOCKED_SESSION,
  LOCK_PROMPT,
  authOutcome,
  lockAvailability,
  needsUnlock,
  sessionOnBackground,
  sessionOnForeground,
  type AuthOutcome,
  type LockAvailability,
  type LockSession,
} from "./personalLock";

/**
 * Estado del candado de "Proteger lo personal" (#171), uno solo para toda la
 * app: la preferencia (guardada en el teléfono), si el teléfono puede
 * autenticar, la sesión de desbloqueo y el estado de la app (para tapar la
 * vista previa del selector de apps). La lógica de decisiones está en
 * `personalLock.ts`; acá solo se conecta con el sistema.
 */

const ENABLED_KEY = "personal-lock-enabled";
const native = Platform.OS === "ios" || Platform.OS === "android";

type Snapshot = {
  /** null mientras se lee la preferencia. */
  enabled: boolean | null;
  availability: LockAvailability | null;
  session: LockSession;
  appState: AppStateStatus;
};

let snapshot: Snapshot = { enabled: null, availability: null, session: LOCKED_SESSION, appState: AppState.currentState ?? "active" };
const listeners = new Set<() => void>();
let started = false;
let pendingAuth: Promise<AuthOutcome> | null = null;

function update(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

async function readEnabled(): Promise<boolean> {
  try {
    if (native) return (await SecureStore.getItemAsync(ENABLED_KEY)) === "1";
    return globalThis.localStorage?.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

async function writeEnabled(value: boolean): Promise<void> {
  if (native) {
    if (value) await SecureStore.setItemAsync(ENABLED_KEY, "1");
    else await SecureStore.deleteItemAsync(ENABLED_KEY);
    return;
  }
  if (value) globalThis.localStorage?.setItem(ENABLED_KEY, "1");
  else globalThis.localStorage?.removeItem(ENABLED_KEY);
}

async function readAvailability(): Promise<LockAvailability> {
  try {
    const [hasHardware, isEnrolled, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    return lockAvailability({ hasHardware, isEnrolled, level });
  } catch {
    return lockAvailability(null);
  }
}

/** Se vuelve a leer al volver a la app: la persona pudo activar o quitar el bloqueo del teléfono. */
async function refreshDevice() {
  const [enabled, availability] = await Promise.all([readEnabled(), readAvailability()]);
  update({ enabled, availability });
}

function onAppState(next: AppStateStatus) {
  const now = Date.now();
  if (next === "background") {
    update({ appState: next, session: sessionOnBackground(snapshot.session, now) });
  } else if (next === "active") {
    update({ appState: next, session: sessionOnForeground(snapshot.session, now) });
    void refreshDevice();
  } else {
    update({ appState: next });
  }
}

function start() {
  if (started) return;
  started = true;
  AppState.addEventListener("change", onAppState);
  void refreshDevice();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

async function authenticate(): Promise<AuthOutcome> {
  if (pendingAuth) return pendingAuth;
  pendingAuth = (async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: LOCK_PROMPT,
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });
      return authOutcome(result);
    } catch {
      return "stay" as const;
    } finally {
      pendingAuth = null;
    }
  })();
  const outcome = await pendingAuth;
  if (outcome === "unlock" || outcome === "pass") {
    update({ session: { unlocked: true, backgroundAt: null } });
  }
  return outcome;
}

function useLockSnapshot() {
  useEffect(start, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export type GateStatus = "checking" | "locked" | "open";

/** Para las pantallas protegidas (Mi espacio, Sentir, Exportar). */
export function usePersonalLockGate() {
  const state = useLockSnapshot();
  const ready = state.enabled !== null && state.availability !== null;
  const enabled = state.enabled === true;
  const available = state.availability?.available === true;
  const status: GateStatus = !ready ? "checking" : needsUnlock(enabled, available, state.session) ? "locked" : "open";
  return {
    status,
    // iOS fotografía la pantalla para el selector de apps al pasar a
    // "inactive"; tapar ahí es lo que deja la vista previa en blanco.
    covered: enabled && available && state.appState !== "active",
    unlock: authenticate,
  };
}

/** Para la fila de Ajustes. Encender y apagar piden autenticar: si no, cualquiera lo apaga. */
export function usePersonalLockSetting() {
  const state = useLockSnapshot();
  return {
    enabled: state.enabled === true,
    loading: state.enabled === null || state.availability === null,
    availability: state.availability,
    async setEnabled(value: boolean): Promise<boolean> {
      const available = state.availability?.available === true;
      if (!available && value) return false;
      if (available) {
        const outcome = await authenticate();
        if (outcome !== "unlock") return false;
      }
      try {
        await writeEnabled(value);
      } catch {
        return false;
      }
      update({ enabled: value });
      return true;
    },
  };
}
