import { useMutation } from "convex/react";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { COMMUNITY_RULES } from "../../../convex/friendsCore";
import { AppButton } from "../../components/AppButton";
import { Icon } from "../../components/Icon";
import { TERMS_OF_USE_URL } from "../../lib/legalLinks";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";

/**
 * Normas de Amigos: la primera vez que se entra, antes de ver o mandar nada
 * (Apple 1.2 pide aceptar términos con cero tolerancia antes de mostrar
 * contenido de otros usuarios). La fecha queda en la cuenta.
 */
export function CommunityRules() {
  const { color } = useTheme();
  const accept = useMutation(api.friends.acceptRules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAccept = async () => {
    setBusy(true);
    setError(null);
    try {
      await accept({});
    } catch {
      setError("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap} testID="amigos-normas">
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Text style={[styles.overline, { color: color.accent }]}>ANTES DE EMPEZAR</Text>
        <Text style={[styles.title, { color: color.ink }]}>Normas de Amigos</Text>
        <Text style={[styles.body, { color: color.inkMuted }]}>
          Amigos es para animarse en la fe: mandarse versículos y escribirse con personas que conocés.
        </Text>
        <View style={styles.rules}>
          {COMMUNITY_RULES.map((rule) => (
            <View key={rule} style={styles.rule}>
              <Icon color={color.sage} name="check" size="sm" />
              <Text style={[styles.ruleText, { color: color.ink }]}>{rule}</Text>
            </View>
          ))}
        </View>
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(TERMS_OF_USE_URL)}
          style={[styles.link, { color: color.accentDeep }]}
        >
          Leer los términos de uso
        </Text>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.body, { color: color.danger }]}>
          {error}
        </Text>
      ) : null}
      <AppButton disabled={busy} onPress={() => void onAccept()} testID="amigos-normas-aceptar">
        {busy ? "Guardando…" : "Acepto las normas"}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.lg },
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  body: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  rules: { gap: tokens.space.md },
  rule: { alignItems: "flex-start", flexDirection: "row", gap: tokens.space.sm },
  ruleText: { flex: 1, fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  link: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
});
