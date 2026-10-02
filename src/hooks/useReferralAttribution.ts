import * as Application from "expo-application";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";

import { api } from "../../convex/_generated/api";
import { referralFromQuery, type ReferralVia } from "../../convex/referralCode";
import { deletePending, getPending, setPending } from "../lib/pendingStore";
import { setReferralAttribute } from "../lib/revenuecat";
import { track } from "../lib/telemetry";

/**
 * Atribución de invitaciones (PRD §9b), sin que la persona haga nada:
 *
 * 1. **Link de la app** (`bibleai://home?ref=BAH-…`): el sitio lo ofrece como
 *    "Ya la instalé, abrir". Se guarda apenas llega, porque puede llegar antes
 *    del login y del onboarding.
 * 2. **Google Play**: el botón del sitio manda `referrer=ref=BAH-…`, y Play se
 *    lo devuelve a la app en la primera apertura (install referrer).
 *
 * En iPhone no hay install referrer: ahí queda el link del punto 1 o
 * escribirlo a mano en Ajustes. Cuando hay sesión, se anota una sola vez
 * (`referrals.claim`), y el código viaja también a RevenueCat.
 */

const PENDING_KEY = "referral-pending";
const PLAY_CHECKED_KEY = "referral-play-checked";
// El pendiente se guarda en `src/lib/pendingStore.ts`, el mismo lugar que la
// invitación a un grupo (#185).

async function rememberFromUrl(url: string | null) {
  const code = referralFromQuery(url);
  if (code) await setPending(PENDING_KEY, code);
}

/** Lo que haya para anotar: primero el link, después Google Play (una sola vez). */
async function nextCandidate(): Promise<{ code: string; via: ReferralVia } | null> {
  const pending = await getPending(PENDING_KEY);
  if (pending) return { code: pending, via: "link" };
  if (Platform.OS !== "android" || (await getPending(PLAY_CHECKED_KEY))) return null;
  try {
    const code = referralFromQuery(await Application.getInstallReferrerAsync());
    // Sin `ref` en el referrer (instalación orgánica) no hay nada que anotar,
    // nunca: se marca ya. Con `ref`, se marca cuando el backend responde.
    if (!code) await setPending(PLAY_CHECKED_KEY, "1");
    return code ? { code, via: "play" } : null;
  } catch {
    return null;
  }
}

export function useReferralAttribution() {
  const currentUser = useQuery(api.users.current);
  const claim = useMutation(api.referrals.claim);
  const claiming = useRef(false);
  const attributed = useRef<string | null>(null);

  // El link puede llegar con la app cerrada (initial URL) o abierta (evento).
  useEffect(() => {
    void Linking.getInitialURL().then(rememberFromUrl).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => void rememberFromUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.referredBy) {
      if (attributed.current !== currentUser.referredBy) {
        attributed.current = currentUser.referredBy;
        void setReferralAttribute(currentUser.referredBy);
      }
      void deletePending(PENDING_KEY);
      return;
    }
    if (claiming.current) return;
    claiming.current = true;
    void (async () => {
      try {
        const candidate = await nextCandidate();
        if (!candidate) return;
        const result = await claim(candidate);
        // Cualquier respuesta es final (anotado, inválido, propio, tarde): no se
        // reintenta. Un error de red sí deja el pendiente para la próxima vez.
        if (candidate.via === "play") await setPending(PLAY_CHECKED_KEY, "1");
        else await deletePending(PENDING_KEY);
        if (result.status === "ok") track("referral_claimed");
      } catch {
        // Sin red o backend viejo: se reintenta en el próximo arranque.
      } finally {
        claiming.current = false;
      }
    })();
  }, [claim, currentUser]);
}
