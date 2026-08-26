import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppButton } from "./AppButton";
import { AppScreen } from "./AppScreen";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type ModulePlaceholderProps = { description: string; title: string };

export function ModulePlaceholder({ description, title }: ModulePlaceholderProps) {
  const { color } = useTheme();

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.main}>
        <Text style={[styles.overline, { color: color.accent }]}>PRÓXIMAMENTE</Text>
        <Text style={[styles.title, { color: color.ink }]}>{title}</Text>
        <Text style={[styles.description, { color: color.inkMuted }]}>{description}</Text>
      </View>
      <AppButton onPress={() => router.replace("/home")} variant="secondary">
        Volver al inicio
      </AppButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "space-between" },
  main: { flex: 1, justifyContent: "center" },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.display.size,
    lineHeight: tokens.type.display.lineHeight,
    marginTop: tokens.space.xl,
  },
  description: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    marginTop: tokens.space.lg,
  },
});
