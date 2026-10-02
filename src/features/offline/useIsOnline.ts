import { useNetInfo } from "@react-native-community/netinfo";

import { isOfflineNetState } from "./offlineCopy";

/** true salvo que NetInfo confirme que no hay red (ver `isOfflineNetState`). */
export function useIsOnline(): boolean {
  const state = useNetInfo();
  return !isOfflineNetState(state);
}
