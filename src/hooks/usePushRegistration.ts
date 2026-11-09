import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import { registerForPush } from "../lib/pushNotifications";

/**
 * Con sesión y permiso ya dado, registra este teléfono para avisos push. Se
 * repite al volver a primer plano: el permiso pudo darse en los ajustes del
 * teléfono, o Expo pudo cambiar el token. No pide permiso: eso lo hace Amigos.
 */
export function usePushRegistration() {
  const { isAuthenticated } = useConvexAuth();
  const register = useMutation(api.push.register);

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPush(register, { ask: false });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void registerForPush(register, { ask: false });
    });
    return () => subscription.remove();
  }, [isAuthenticated, register]);
}
