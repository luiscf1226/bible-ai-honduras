import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { tokens } from "../src/theme/tokens";

const PRIVACY_URL = "https://luiscf1226.github.io/bible-ai-honduras/privacidad/";

export default function AiConsentScreen() {
  const currentUser = useQuery(api.users.current);
  const acceptConsent = useMutation(api.users.acceptAiConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptConsent({});
      router.replace(currentUser?.reminderHour === undefined ? "/notifications" : "/home");
    } catch {
      setError("No pudimos guardar tu decisión. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>TU PRIVACIDAD</Text>
        <Text style={styles.title}>Antes de usar las funciones con IA</Text>
        <Text style={styles.description}>
          Preguntar, Voces y Sentir envían lo que escribís a OpenAI para buscar pasajes y a Anthropic para redactar la respuesta. El contenido puede incluir creencias o emociones sensibles.
        </Text>
        <Text style={styles.warning}>No incluyás datos personales que no querás compartir con esos proveedores.</Text>
        <AppButton onPress={() => void Linking.openURL(PRIVACY_URL)} variant="quiet">
          Leer la política de privacidad
        </AppButton>
      </View>
      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton disabled={saving || !currentUser} onPress={accept} testID="accept-ai-consent">
          {saving ? "Guardando…" : "Acepto y continuar"}
        </AppButton>
        <AppButton disabled={saving} onPress={() => router.replace("/home")} variant="quiet">
          Ahora no
        </AppButton>
        <Text style={styles.note}>Sin este consentimiento podés usar el contenido que no envía texto personal a IA.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "space-between" },
  eyebrow: { color: tokens.color.accentDeep, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.lg },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.xl },
  warning: { color: tokens.color.ink, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.lg },
  actions: { gap: tokens.space.md },
  error: { color: tokens.color.danger, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" },
  note: { color: tokens.color.inkFaint, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" },
});
