import { reloadAppAsync } from "expo";
import { StyleSheet, View } from "react-native";

import { LoadingState } from "./LoadingState";
import { CLERK_LOAD_RETRY_MS } from "../features/auth/startupGate";
import { tokens } from "../theme/tokens";

/**
 * Lo que se ve mientras el arranque espera (Clerk, Convex): el logo sobre el
 * fondo del splash, nunca una pantalla vacía. Pasado `CLERK_LOAD_RETRY_MS`
 * ofrece "Reintentar", que recarga la app — rechazo 2.1(a) de la 1.0.2.
 */
export function StartupLoading({ testID }: { testID: string }) {
  return (
    <View style={styles.screen}>
      <LoadingState
        message="Abriendo la app…"
        onRetry={() => void reloadAppAsync("El arranque no terminó").catch(() => undefined)}
        retryAfterMs={CLERK_LOAD_RETRY_MS}
        showBrand
        testID={testID}
      />
    </View>
  );
}

// Mismo fondo que `app/splash.tsx`.
const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg, flex: 1 },
});
