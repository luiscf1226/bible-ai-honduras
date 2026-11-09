import { useAuth } from "@clerk/expo";
import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { api } from "../../../convex/_generated/api";
import { cancelDailyDevotionalReminder } from "../../lib/dailyReminder";
import { unregisterPush } from "../../lib/pushNotifications";
import { logOut as purchasesLogOut } from "../../lib/revenuecat";
import { useOfflineSync } from "../offline/OfflineSyncProvider";

/**
 * Cerrar sesión de verdad: Clerk, RevenueCat, el recordatorio local y los
 * avisos push. Si el aviso diario o el token push sobrevivieran, seguirían
 * llegando notificaciones de una cuenta desconectada. Ningún paso puede bloquear a los otros.
 *
 * Un solo dueño para Ajustes y el perfil de Mi espacio: cerrar sesión tiene
 * que estar siempre a mano, y no puede haber dos versiones que limpien cosas
 * distintas.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const { clearUserData } = useOfflineSync();
  const unregister = useMutation(api.push.unregister);
  const [signingOut, setSigningOut] = useState(false);

  async function endSession() {
    try {
      // La cola sin conexión y lo último visto son de esta cuenta (#182). La
      // Biblia descargada no es de nadie: se queda en el teléfono.
      await clearUserData();
    } catch {
      // Un archivo que no se pudo borrar no bloquea el cierre de sesión.
    }
    try {
      await cancelDailyDevotionalReminder();
    } catch {
      // Sin permiso de notificaciones no hay nada agendado que cancelar.
    }
    // Antes de cerrar Clerk. Nunca bloquea: sin red queda pendiente y se reintenta.
    await unregisterPush(unregister);
    try {
      await purchasesLogOut();
    } catch {
      // logOut ya devuelve el error en vez de lanzarlo; esto es cinturón.
    }
    try {
      await signOut();
    } finally {
      router.replace("/splash");
    }
  }

  function askSignOut() {
    Alert.alert("¿Cerrar sesión?", "Volvés a la pantalla de inicio. Tus datos siguen en tu cuenta.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => {
          setSigningOut(true);
          void endSession().finally(() => setSigningOut(false));
        },
      },
    ]);
  }

  return { askSignOut, endSession, signingOut };
}
