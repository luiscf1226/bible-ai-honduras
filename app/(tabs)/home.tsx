import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { tokens } from "../../src/theme/tokens";

const modules = [
  { description: "Elige un pasaje", href: "/preguntar", title: "Pregunta al texto" },
  { description: "Habla con Moisés, Ester…", href: "/voces", title: "Voces" },
  { description: "Mira una historia bíblica en imágenes", href: "/historias", title: "Historias ilustradas" },
  { description: "Recibe un devocional para tu día", href: "/sentir", title: "¿Cómo estás hoy?" }
] as const;

export default function HomeScreen() {
  return (
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Brand size="small" />
          <View>
            <Text style={styles.date}>DEVOCIONAL DE HOY</Text>
            <Text style={styles.greeting}>Buenas noches, Elena</Text>
          </View>
        </View>
      </View>

      <View style={styles.verseCard}>
        <Text style={styles.overline}>VERSÍCULO DEL DÍA</Text>
        <Text style={styles.verse}>“Aunque ande en valle de sombra de muerte, no temeré mal alguno, porque tú estarás conmigo.”</Text>
        <Text style={styles.reference}>Salmos 23:4 · RVR1960</Text>
        <Text style={styles.hint}>Leer el devocional de hoy</Text>
      </View>

      <Text style={styles.sectionTitle}>Acompañamiento</Text>
      <View style={styles.moduleGrid}>
        {modules.map((module) => (
          <Pressable accessibilityRole="button" key={module.href} onPress={() => router.push(module.href)} style={styles.moduleCard}>
            <Text style={styles.moduleTitle}>{module.title}</Text>
            <Text style={styles.moduleDescription}>{module.description}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: tokens.color.surface },
  content: { gap: tokens.space.xxl },
  header: { marginTop: tokens.space.sm },
  identity: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  date: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  greeting: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xs },
  verseCard: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xxl, borderWidth: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  overline: { color: tokens.color.accent, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  verse: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xl },
  reference: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl },
  hint: { borderTopColor: tokens.color.border, borderTopWidth: 1, color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl, paddingTop: tokens.space.lg },
  sectionTitle: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.md },
  moduleCard: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xl, borderWidth: 1, flexGrow: 1, flexShrink: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.xl, width: "45%" },
  moduleTitle: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  moduleDescription: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs }
});
