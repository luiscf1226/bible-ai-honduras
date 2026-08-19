import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { tokens } from "../../src/theme/tokens";

const steps = [
  { body: "Cada mañana, un versículo. Si tienes tiempo, se abre en un devocional completo. Si no, con el versículo basta.", cta: "Continuar", title: "Un lugar tranquilo para leer" },
  { body: "Elige un pasaje y pregunta sobre él. Las respuestas citan siempre el texto bíblico, no opiniones sueltas.", cta: "Continuar", title: "Pregunta lo que no te atreves a preguntar" },
  { body: "Tus conversaciones son privadas y no se usan para entrenar modelos de IA. Puedes borrarlas cuando quieras.", cta: "Empezar", title: "Nadie te va a ver aquí" }
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const next = () => step < steps.length - 1 ? setStep(step + 1) : router.replace("/notifications");

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.main}>
        <Brand size="medium" />
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.body}</Text>
      </View>
      <View>
        <View accessibilityLabel={`Paso ${step + 1} de ${steps.length}`} style={styles.dots}>
          {steps.map((item, index) => <View key={item.title} style={[styles.dot, index === step && styles.dotActive]} />)}
        </View>
        <View style={styles.actions}>
          <AppButton onPress={next}>{current.cta}</AppButton>
          <AppButton onPress={() => router.replace("/home")} variant="quiet">Saltar</AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "space-between" },
  main: { flex: 1, justifyContent: "center" },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight, marginTop: tokens.space.xxl },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.xl },
  dots: { flexDirection: "row", gap: tokens.space.sm, marginBottom: tokens.space.xxl },
  dot: { backgroundColor: tokens.color.borderStrong, borderRadius: tokens.radius.pill, height: tokens.size.dot, width: tokens.size.dot },
  dotActive: { backgroundColor: tokens.color.accentDeep, width: tokens.size.dotActive },
  actions: { gap: tokens.space.sm }
});
