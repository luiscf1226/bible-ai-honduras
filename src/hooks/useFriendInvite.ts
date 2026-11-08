import { useQuery } from "convex/react";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking } from "react-native";

import { api } from "../../convex/_generated/api";
import { friendCodeFromUrl } from "../../convex/friendsCore";
import { FRIEND_INVITE_PATH, PENDING_FRIEND_INVITE_KEY, shouldOpenPendingInvite } from "../features/groups/pendingInvite";
import { deletePending, getPending, setPending } from "../lib/pendingStore";

/**
 * Invitación a ser amigos (1.0.3): `bibleai://amigo?code=…`. Igual que
 * `useGroupInvite`: con sesión expo-router abre `/amigo` solo; acá se guarda
 * el link que llega antes del login o del onboarding y se abre después.
 */
export function useFriendInvite() {
  const currentUser = useQuery(api.users.current);
  const pathname = usePathname();
  const opening = useRef(false);

  useEffect(() => {
    const remember = (url: string | null) => {
      const code = friendCodeFromUrl(url);
      if (code) void setPending(PENDING_FRIEND_INVITE_KEY, code);
    };
    void Linking.getInitialURL().then(remember).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => remember(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!currentUser || opening.current) return;
    opening.current = true;
    void (async () => {
      try {
        const pendingCode = await getPending(PENDING_FRIEND_INVITE_KEY);
        if (!shouldOpenPendingInvite({ pendingToken: pendingCode, signedIn: true, pathname, invitePath: FRIEND_INVITE_PATH })) return;
        await deletePending(PENDING_FRIEND_INVITE_KEY);
        router.push({ pathname: FRIEND_INVITE_PATH, params: { code: pendingCode as string } });
      } finally {
        opening.current = false;
      }
    })();
  }, [currentUser, pathname]);
}

/** La pantalla de la invitación la consume: no se vuelve a abrir sola. */
export function clearPendingFriendInvite(): Promise<void> {
  return deletePending(PENDING_FRIEND_INVITE_KEY);
}
