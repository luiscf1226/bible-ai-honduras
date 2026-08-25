import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { api } from "../../convex/_generated/api";
import { tokens } from "../../src/theme/tokens";

const modules = [
  { description: "Elige un pasaje", href: "/preguntar", title: "Pregunta al texto" },
  { description: "Habla con Moisés, Ester…", href: "/voces", title: "Voces" },
  { description: "Mira una historia bíblica en imágenes", href: "/historias", title: "Historias ilustradas" }
] as const;

type TodayDevotional = FunctionReturnType<typeof api.devotional.today>;

type DevotionalState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; devotional: TodayDevotional };

function useTodayDevotional() {
  const convex = useConvex();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<DevotionalState>({ status: "loading" });

  useEffect(() => {
    let isCurrent = true;
    setState({ status: "loading" });

    void convex.query(api.devotional.today, {}).then(
      (devotional) => {
        if (isCurrent) setState({ devotional, status: "ready" });
      },
      () => {
        if (isCurrent) setState({ status: "error" });
      }
    );

    return () => {
      isCurrent = false;
    };
  }, [convex, request]);

  return { retry: () => setRequest((value) => value + 1), state };
}

function hondurasDate() {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    timeZone: "America/Tegucigalpa",
    weekday: "long"
  }).format(new Date());
}

export default function HomeScreen() {
  const { retry, state } = useTodayDevotional();
  const [isDevotionalOpen, setIsDevotionalOpen] = useState(false);

  const isReady = state.status === "ready";
  const devotional = isReady ? state.devotional : null;

  const onDevotionalPress = () => {
    if (state.status === "error") {
      retry();
      return;
    }

    if (isReady) setIsDevotionalOpen((isOpen) => !isOpen);
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Brand size="small" />
          <View>
            <Text style={styles.date}>{hondurasDate()}</Text>
            <Text style={styles.greeting}>Devocional de hoy</Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityHint={state.status === "error" ? "Vuelve a intentar cargar el devocional." : "Abre o cierra el devocional completo."}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.status === "loading", expanded: isDevotionalOpen }}
        disabled={state.status === "loading"}
        onPress={onDevotionalPress}
        style={({ pressed }) => [styles.verseCard, pressed && styles.pressed]}
        testID="home-devotional-toggle"
      >
        <Text style={styles.overline}>VERSÍCULO DEL DÍA</Text>
        <Text style={styles.verse}>
          {state.status === "loading"
            ? "Preparando la lectura de hoy…"
            : state.status === "error"
              ? "No pudimos preparar tu lectura. Tocá para intentarlo de nuevo."
              : devotional?.verseRef}
        </Text>
        {devotional ? <Text style={styles.reference}>RVR1960</Text> : null}
        <Text style={styles.hint}>
          {isDevotionalOpen ? "Cerrar el devocional" : "Leer el devocional de hoy"}
        </Text>
      </Pressable>

      {isDevotionalOpen && devotional ? (
        <View style={styles.devotionalCard} testID="home-devotional-expanded">
          <Image
            accessibilityLabel={devotional.imageAlt}
            source={{ uri: devotional.imageUrl }}
            style={styles.devotionalImage}
          />
          <View style={styles.devotionalBody}>
            <Text style={styles.devotionalTitle}>Una pausa para hoy</Text>
            <Text style={styles.reflection}>{devotional.reflection}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/sentir")}
        style={({ pressed }) => [styles.feelingCard, pressed && styles.pressed]}
      >
        <Text style={styles.feelingTitle}>¿Cómo estás hoy?</Text>
        <Text style={styles.feelingDescription}>Contame qué llevás encima y te preparo un devocional para eso.</Text>
      </Pressable>

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
  pressed: { opacity: tokens.opacity.pressed },
  overline: { color: tokens.color.accent, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  verse: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xl },
  reference: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl },
  hint: { borderTopColor: tokens.color.border, borderTopWidth: 1, color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl, paddingTop: tokens.space.lg },
  devotionalCard: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xxl, borderWidth: 1, overflow: "hidden" },
  devotionalImage: { aspectRatio: 16 / 9, width: "100%" },
  devotionalBody: { paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  devotionalTitle: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  reflection: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg },
  feelingCard: { backgroundColor: tokens.color.surfaceAlt, borderColor: tokens.color.border, borderRadius: tokens.radius.xl, borderWidth: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  feelingTitle: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  feelingDescription: { color: tokens.color.inkMuted, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  sectionTitle: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.md },
  moduleCard: { backgroundColor: tokens.color.surface, borderColor: tokens.color.border, borderRadius: tokens.radius.xl, borderWidth: 1, flexGrow: 1, flexShrink: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.xl, width: "45%" },
  moduleTitle: { color: tokens.color.ink, fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  moduleDescription: { color: tokens.color.inkSoft, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs }
});
