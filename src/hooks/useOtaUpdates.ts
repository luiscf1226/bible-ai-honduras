import * as Updates from "expo-updates";
import { useEffect } from "react";
import { AppState } from "react-native";

/**
 * Actualizaciones por EAS Update (1.0.4): un cambio solo de JS llega sin
 * pasar por la tienda. Al abrir, expo-updates ya busca solo; esto busca
 * también al volver a primer plano y deja la actualización bajada para el
 * próximo arranque. Nunca recarga la app en la cara de nadie.
 */
export function useOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const fetchIfAvailable = async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Sin red o sin servidor: se intenta la próxima vez.
      }
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void fetchIfAvailable();
    });
    return () => subscription.remove();
  }, []);
}
