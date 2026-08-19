import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { AppScreen } from "../../src/components/AppScreen";
import { tokens } from "../../src/theme";

export default function LoginScreen() {
  const continueToOnboarding = () => router.replace("/onboarding");

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.title}>Bienvenido a Bible AI</Text>
        <Text style={styles.description}>
          Creamos una cuenta para guardar tus devocionales y tu progreso. Nada de tu conversación se hace público.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button onPress={continueToOnboarding} variant="secondary">Continuar con Google</Button>
        <Button onPress={continueToOnboarding}>Continuar con Apple</Button>
        <Button onPress={continueToOnboarding} variant="quiet">Usar mi correo</Button>
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
  legal: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.sm, textAlign: "center" }
});
