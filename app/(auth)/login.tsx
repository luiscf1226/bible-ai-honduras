import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSSO } from "@clerk/expo/experimental";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme/tokens";

type Provider = "oauth_google" | "oauth_apple";

export default function LoginScreen() {
  const { startSSOFlow } = useSSO();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El futuro useSSO (Core 3) finaliza y activa la sesión sola apenas hay
  // createdSessionId — no hay setActive que llamar acá. Si el usuario cancela
  // el flujo del browser, createdSessionId viene null y no navegamos.
  const continueWith = useCallback(
    async (strategy: Provider) => {
      setError(null);
      setPending(strategy);
      try {
        const { createdSessionId } = await startSSOFlow({ strategy });
        if (createdSessionId) {
          router.replace("/onboarding");
        }
      } catch (ssoError) {
        console.error("SSO sign-in falló", ssoError);
        setError("No pudimos completar el inicio de sesión. Intentá de nuevo.");
      } finally {
        setPending(null);
      }
    },
    [startSSOFlow]
  );

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.title}>Bienvenido a Bible AI</Text>
        <Text style={styles.description}>
          Creamos una cuenta para guardar tus devocionales y tu progreso. Nada de tu conversación se hace público.
        </Text>
      </View>
      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton disabled={pending !== null} onPress={() => continueWith("oauth_google")} variant="secondary">
          {pending === "oauth_google" ? "Conectando…" : "Continuar con Google"}
        </AppButton>
        <AppButton disabled={pending !== null} onPress={() => continueWith("oauth_apple")}>
          {pending === "oauth_apple" ? "Conectando…" : "Continuar con Apple"}
        </AppButton>
        <AppButton disabled={pending !== null} onPress={() => router.push("/email")} variant="quiet">
          Usar mi correo
        </AppButton>
        <Text style={styles.legal}>Al continuar aceptas los términos y el aviso de privacidad.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "flex-end" },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg },
  actions: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  error: { color: tokens.color.accentDeep, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" },
  legal: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.sm, textAlign: "center" }
});
