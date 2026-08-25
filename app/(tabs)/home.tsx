import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { api } from "../../convex/_generated/api";
import { parseVerseRef } from "../../src/lib/parseVerseRef";
import { useTheme } from "../../src/theme/ThemeProvider";
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
  const { color, dark } = useTheme();
  const { retry, state } = useTodayDevotional();
  const [isDevotionalOpen, setIsDevotionalOpen] = useState(false);

  const isReady = state.status === "ready";
  const devotional = isReady ? state.devotional : null;
  const parsed = parseVerseRef(devotional?.verseRef ?? "");
  const cited = useQuery(api.rag.verses.citedForUser, parsed ?? "skip");
  const bibleVersion = cited?.version ?? "RVR1960";
  const verseText = cited?.verse?.text;

  const onDevotionalPress = () => {
    if (state.status === "error") {
      retry();
      return;
    }

    if (isReady) setIsDevotionalOpen((isOpen) => !isOpen);
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: dark ? color.bg : color.surface }}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <Brand size="small" />
          <View>
            <Text style={[styles.date, { color: color.inkSoft }]}>{hondurasDate()}</Text>
            <Text style={[styles.greeting, { color: color.ink }]}>Devocional de hoy</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Ajustes"
          accessibilityRole="button"
          onPress={() => router.push("/ajustes")}
          style={[styles.settingsButton, { backgroundColor: color.surface, borderColor: color.borderStrong }]}
          testID="home-settings"
        >
          <Text style={[styles.settingsIcon, { color: color.inkMuted }]}>⚙</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityHint={state.status === "error" ? "Vuelve a intentar cargar el devocional." : "Abre o cierra el devocional completo."}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.status === "loading", expanded: isDevotionalOpen }}
        disabled={state.status === "loading"}
        onPress={onDevotionalPress}
        style={({ pressed }) => [
          styles.verseCard,
          { backgroundColor: color.surface, borderColor: color.border },
          pressed && styles.pressed,
        ]}
        testID="home-devotional-toggle"
      >
        <Text style={[styles.overline, { color: color.accent }]}>VERSÍCULO DEL DÍA</Text>
        <Text style={[styles.verse, { color: color.ink }]}>
          {state.status === "loading"
            ? "Preparando la lectura de hoy…"
            : state.status === "error"
              ? "No pudimos preparar tu lectura. Tocá para intentarlo de nuevo."
              : verseText
                ? `“${verseText}”`
                : devotional?.verseRef}
        </Text>
        {devotional ? (
          <Text style={[styles.reference, { color: color.inkMuted }]}>
            {verseText ? `${devotional.verseRef} · ${bibleVersion}` : bibleVersion}
          </Text>
        ) : null}
        <Text style={[styles.hint, { borderTopColor: color.border, color: color.inkSoft }]}>
          {isDevotionalOpen ? "Cerrar el devocional" : "Leer el devocional de hoy"}
        </Text>
      </Pressable>

      {isDevotionalOpen && devotional ? (
        <View style={[styles.devotionalCard, { backgroundColor: color.surface, borderColor: color.border }]} testID="home-devotional-expanded">
          <Image
            accessibilityLabel={devotional.imageAlt}
            source={{ uri: devotional.imageUrl }}
            style={styles.devotionalImage}
          />
          <View style={styles.devotionalBody}>
            <Text style={[styles.devotionalTitle, { color: color.ink }]}>Una pausa para hoy</Text>
            <Text style={[styles.reflection, { color: color.inkMuted }]}>{devotional.reflection}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/sentir")}
        style={({ pressed }) => [
          styles.feelingCard,
          { backgroundColor: dark ? color.surfaceSunk : color.surfaceAlt, borderColor: color.border },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.feelingTitle, { color: color.ink }]}>¿Cómo estás hoy?</Text>
        <Text style={[styles.feelingDescription, { color: color.inkMuted }]}>Contame qué llevás encima y te preparo un devocional para eso.</Text>
      </Pressable>

      {dark ? (
        <Text style={[styles.nightHint, { color: color.inkFaint }]}>Modo noche suave activo · desactívalo en ajustes</Text>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>Acompañamiento</Text>
          <View style={styles.moduleGrid}>
            {modules.map((module) => (
              <Pressable
                accessibilityRole="button"
                key={module.href}
                onPress={() => router.push(module.href)}
                style={[styles.moduleCard, { backgroundColor: color.surface, borderColor: color.border }]}
              >
                <Text style={[styles.moduleTitle, { color: color.ink }]}>{module.title}</Text>
                <Text style={[styles.moduleDescription, { color: color.inkSoft }]}>{module.description}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xxl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: tokens.space.sm },
  identity: { alignItems: "center", flexDirection: "row", flex: 1, gap: tokens.space.md },
  settingsButton: { alignItems: "center", borderRadius: tokens.radius.pill, borderWidth: 1, height: tokens.size.logoSmall, justifyContent: "center", width: tokens.size.logoSmall },
  settingsIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  date: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  greeting: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xs },
  verseCard: { borderRadius: tokens.radius.xxl, borderWidth: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  overline: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  verse: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight, marginTop: tokens.space.xl },
  reference: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl },
  hint: { borderTopWidth: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xl, paddingTop: tokens.space.lg },
  devotionalCard: { borderRadius: tokens.radius.xxl, borderWidth: 1, overflow: "hidden" },
  devotionalImage: { aspectRatio: 16 / 9, width: "100%" },
  devotionalBody: { paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  devotionalTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  reflection: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight, marginTop: tokens.space.lg },
  feelingCard: { borderRadius: tokens.radius.xl, borderWidth: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  feelingTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  feelingDescription: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  sectionTitle: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.overline.size, letterSpacing: tokens.type.overline.letterSpacing, lineHeight: tokens.type.overline.lineHeight },
  nightHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.md },
  moduleCard: { borderRadius: tokens.radius.xl, borderWidth: 1, flexGrow: 1, flexShrink: 1, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.xl, width: "45%" },
  moduleTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  moduleDescription: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs }
});
