import { useQuery } from "convex/react";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking } from "react-native";

import { api } from "../../convex/_generated/api";
import { inviteTokenFromUrl } from "../../convex/readingGroupCore";
import { GROUP_INVITE_PATH, PENDING_GROUP_INVITE_KEY, shouldOpenPendingInvite } from "../features/groups/pendingInvite";
import { deletePending, getPending, setPending } from "../lib/pendingStore";

/**
 * Invitación a un plan en grupo (#185): `bibleai://grupo?token=…`.
 *
 * Con sesión, expo-router ya abre `/grupo` solo. Lo que este hook resuelve es
 * el link que llega **antes** de poder usarlo (app recién instalada, sin
 * sesión, en el onboarding): se guarda apenas llega, igual que el código de
 * `useReferralAttribution`, y se abre cuando la persona entra a la app.
 */
export function useGroupInvite() {
  const currentUser = useQuery(api.users.current);
  const pathname = usePathname();
  const opening = useRef(false);

  useEffect(() => {
    const remember = (url: string | null) => {
      const token = inviteTokenFromUrl(url);
      if (token) void setPending(PENDING_GROUP_INVITE_KEY, token);
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
        const pendingToken = await getPending(PENDING_GROUP_INVITE_KEY);
        if (!shouldOpenPendingInvite({ pendingToken, signedIn: true, pathname })) return;
        await deletePending(PENDING_GROUP_INVITE_KEY);
        router.push({ pathname: GROUP_INVITE_PATH, params: { token: pendingToken as string } });
      } finally {
        opening.current = false;
      }
    })();
  }, [currentUser, pathname]);
}

/** La pantalla de la invitación la consume: no se vuelve a abrir sola. */
export function clearPendingGroupInvite(): Promise<void> {
  return deletePending(PENDING_GROUP_INVITE_KEY);
}
