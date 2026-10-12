import { router } from "expo-router";
import { useEffect, useRef, type PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { usePersonalLockGate } from "../features/personal/personalLockStore";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";
import { AppButton } from "./AppButton";
import { FullScreenNotice } from "./FullScreenNotice";
import { ListCard } from "./ListRow";

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
const LOCKED_BODY =
  "Pusiste un candado a tus notas, guardados y lo que escribís en Sentir. Usá Face ID, la huella o el PIN del teléfono para entrar.";

type PersonalLockGateProps = PropsWithChildren<{
  /**
   * `true` en el perfil de Mi espacio: cerrado, el candado es una tarjeta en
   * su lugar y cancelar no saca de la pantalla. El perfil (Ajustes, cerrar
   * sesión, eliminar cuenta) tiene que quedar siempre a mano, aunque falle
   * Face ID.
   */
  inline?: boolean;
}>;

export function PersonalLockGate({ children, inline = false }: PersonalLockGateProps) {
  const { color } = useTheme();
  const { covered, status, unlock } = usePersonalLockGate();
  const prompted = useRef(false);

  async function attempt() {
    const outcome = await unlock();
    if (outcome === "back" && !inline) leave();
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

  if (inline) {
    if (status === "checking") return null;
    if (status === "locked") {
      return (
        <ListCard testID="candado" tone="sunk">
          <View style={styles.inline}>
            <Text accessibilityRole="header" style={[styles.inlineTitle, { color: color.ink }]}>
              Esto es solo tuyo
            </Text>
            <Text style={[styles.inlineBody, { color: color.inkMuted }]}>{LOCKED_BODY}</Text>
            <AppButton icon="lock" onPress={() => void attempt()} testID="candado-cta" variant="secondary">
              Desbloquear
            </AppButton>
          </View>
        </ListCard>
      );
    }
    return (
      <View>
        {children}
        {covered ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.surface }]} testID="candado-tapa" />
        ) : null}
      </View>
    );
  }

  if (status === "checking") {
    return <View style={[styles.fill, { backgroundColor: color.surface }]} testID="candado-cargando" />;
  }

  if (status === "locked") {
    return (
      <FullScreenNotice
        body={LOCKED_BODY}
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
  inline: { gap: tokens.space.md, paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  inlineTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  inlineBody: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
