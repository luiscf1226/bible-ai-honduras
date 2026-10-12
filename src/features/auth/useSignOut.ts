import { useAuth } from "@clerk/expo";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { cancelDailyDevotionalReminder } from "../../lib/dailyReminder";
import { logOut as purchasesLogOut } from "../../lib/revenuecat";
import { useOfflineSync } from "../offline/OfflineSyncProvider";

/**
 * Cerrar sesión de verdad: Clerk, RevenueCat y el recordatorio local. Si el
 * aviso diario sobreviviera, seguirían llegando notificaciones de una cuenta
 * desconectada. Ningún paso puede bloquear a los otros.
 *
 * Un solo dueño para Ajustes y el perfil de Mi espacio: cerrar sesión tiene
 * que estar siempre a mano, y no puede haber dos versiones que limpien cosas
 * distintas.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const { clearUserData } = useOfflineSync();
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
