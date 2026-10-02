import { router } from "expo-router";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { usePersonalLockGate } from "../features/personal/personalLockStore";
import { useTheme } from "../theme/ThemeProvider";
import { FullScreenNotice } from "./FullScreenNotice";

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace("/home");
}

/**
 * Candado de "Proteger lo personal" (#171). Mientras está cerrado, la pantalla
 * de adentro ni se monta: no corre ninguna query ni se ve nada detrás. Pide
 * autenticar solo apenas entra; si la persona cancela, vuelve atrás.
 *
 * La pantalla de bloqueo es `FullScreenNotice` (el mismo layout de "Por hoy
 * llegaste al límite"), sin tokens nuevos. Falta ratificarla en Claude Design.
 */
export function PersonalLockGate({ children }: PropsWithChildren) {
  const { color } = useTheme();
  const { covered, status, unlock } = usePersonalLockGate();
  const prompted = useRef(false);

  async function attempt() {
    const outcome = await unlock();
    if (outcome === "back") leave();
  }

  useEffect(() => {
    if (status !== "locked") {
      prompted.current = false;
      return;
    }
    if (prompted.current) return;
    prompted.current = true;
    void attempt();
  }, [status]);

  if (status === "checking") {
    return <View style={[styles.fill, { backgroundColor: color.surface }]} testID="candado-cargando" />;
  }

  if (status === "locked") {
    return (
      <FullScreenNotice
        body="Pusiste un candado a tus notas, guardados y lo que escribís en Sentir. Usá Face ID, la huella o el PIN del teléfono para entrar."
        cta="Desbloquear"
        mark="◉"
        onCta={() => void attempt()}
        testID="candado"
        title="Esto es solo tuyo"
      />
    );
  }

  return (
    <View style={styles.fill}>
      {children}
      {covered ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.surface }]} testID="candado-tapa" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
