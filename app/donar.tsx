import { Redirect } from "expo-router";
import { useState } from "react";
import { Linking, Platform, StyleSheet, Text } from "react-native";

import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import { donationUrl } from "../src/lib/donations";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

/**
 * Donar: explica para qué es y abre el link de donación en el navegador. La
 * app no cobra nada (src/lib/donations.ts dice por qué). Sin link para esta
 * plataforma, la pantalla no existe.
 */
export default function DonarScreen() {
  const url = donationUrl(Platform.OS);
  return url ? <DonarContent url={url} /> : <Redirect href="/ajustes" />;
}

function DonarContent({ url }: { url: string }) {
  const { color } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);

  const open = async () => {
    setNotice(null);
    try {
      await Linking.openURL(url);
    } catch {
      setNotice("No pudimos abrir el navegador. Probá de nuevo.");
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader accessibilityLabel="Volver" style={styles.header} title="Donar" />
      <Text style={[styles.title, { color: color.ink }]}>Ayudanos a que siga siendo gratis</Text>
      <Text style={[styles.body, { color: color.inkMuted }]}>
        Cada pregunta, conversación e historia usa inteligencia artificial, y eso cuesta. Tu donación ayuda a pagarla
        para que más hermanos en Honduras puedan usar la app sin pagar.
      </Text>
      <AppButton icon="heart" onPress={() => void open()} style={styles.button} testID="donar-abrir">
        Donar
      </AppButton>
      <Text style={[styles.caption, { color: color.inkSoft }]}>
        Se abre en tu navegador. La app no procesa pagos ni guarda datos de tu tarjeta.
      </Text>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: color.danger }]} testID="donar-aviso">
          {notice}
        </Text>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.xxl },
  title: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  body: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
  button: { marginTop: tokens.space.xxl },
  caption: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.md,
    textAlign: "center",
  },
});
