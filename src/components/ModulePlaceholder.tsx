import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "./Button";
import { AppScreen } from "./AppScreen";
import { tokens } from "../theme";

type ModulePlaceholderProps = { description: string; title: string };

export function ModulePlaceholder({ description, title }: ModulePlaceholderProps) {
  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.main}>
        <Text style={styles.overline}>PRÓXIMAMENTE</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Button onPress={() => router.replace("/home")} variant="secondary">Volver al inicio</Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { justifyContent: "space-between" },
  main: { flex: 1, justifyContent: "center" },
  overline: { color: tokens.color.accent, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight, marginTop: tokens.space.xl },
  description: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg }
});
