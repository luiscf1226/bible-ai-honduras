import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../../src/components/AppScreen";
import { tokens } from "../../../src/theme/tokens";

// Esqueleto: recibe el pasaje elegido en el selector (#12) y lo muestra.
// El flujo de pregunta real (enviar, RAG, cita, historial) es #13/#14.
export default function PreguntarChatScreen() {
  const { book, chapter, verse } = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();

  const contextLabel = book
    ? `${book}${chapter ? ` ${chapter}` : ""}${verse ? `:${verse}` : ""}`
    : "Pregunta libre";

  return (
    <AppScreen contentStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{contextLabel}</Text>
      </View>
      <Text style={styles.placeholder}>Próximamente vas a poder preguntar acá.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: tokens.space.xl },
  header: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  backButton: { alignItems: "center", borderColor: tokens.color.border, borderRadius: tokens.radius.pill, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  backIcon: { color: tokens.color.ink, fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  title: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size },
  placeholder: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size }
});
