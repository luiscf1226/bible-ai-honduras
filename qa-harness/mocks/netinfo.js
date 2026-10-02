// Mock de `@react-native-community/netinfo` para el harness de QA (#160).
// `?net=off` simula el modo avión; sin el parámetro, siempre hay conexión.
import { isOffline } from "./scenario";

function state() {
  const online = !isOffline();
  return {
    type: online ? "wifi" : "none",
    isConnected: online,
    isInternetReachable: online,
    details: null,
  };
}

export function useNetInfo() {
  return state();
}

export function fetch() {
  return Promise.resolve(state());
}

export function refresh() {
  return Promise.resolve(state());
}

export function addEventListener(listener) {
  listener(state());
  return () => undefined;
}

export function configure() {}

export default { addEventListener, configure, fetch, refresh, useNetInfo };
