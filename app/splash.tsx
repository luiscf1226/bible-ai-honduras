import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { Brand } from "../src/components/Brand";
import { tokens } from "../src/theme/tokens";

export default function SplashScreen() {
  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.center}>
        <Brand size="large" withWordmark />
        <Text style={styles.tagline}>TU FE. TUS PREGUNTAS. SU PALABRA.</Text>
      </View>
      <AppButton onPress={() => router.push("/login")} testID="entrar">
        Toca para entrar
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.bg },
  content: { justifyContent: "space-between" },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  tagline: {
    color: tokens.color.inkSoft,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginTop: tokens.space.xxl,
    textAlign: "center"
  }
});
