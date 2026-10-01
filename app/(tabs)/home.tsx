import { DEFAULT_BIBLE_VERSION } from "../../convex/bibleVersions";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { LoadingState } from "../../src/components/LoadingState";
import { useAppUpdate } from "../../src/hooks/useAppUpdate";
import { buildDevotionalShareText } from "../../src/features/home/shareDevotional";
import { shareContent } from "../../src/lib/share";
import { api } from "../../convex/_generated/api";
import { parseVerseRef } from "../../src/lib/parseVerseRef";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

// Barra fija de abajo: las 4 entradas a los módulos (no hay tab bar). Antes
// eran un grid de tarjetas debajo del devocional y la home se sentía cargada
// (reporte de la beta); abajo quedan siempre a mano sin competir con el
// versículo. Cada entrada dice qué hace, no solo cómo se llama el módulo.
const modules = [
  { a11y: "Leer la Biblia: planes de lectura y tu separador", caption: "la Biblia", href: "/leer", title: "Leer", testID: "home-dock-leer" },
  { a11y: "Pregunta al texto: elegí un pasaje y preguntá", caption: "sobre un pasaje", href: "/preguntar", title: "Preguntar", testID: "home-dock-preguntar" },
  { a11y: "Voces: conversá con Moisés, Ester y otros personajes", caption: "Moisés, Ester…", href: "/voces", title: "Voces", testID: "home-dock-voces" },
  { a11y: "Historias bíblicas en texto e imágenes", caption: "texto e imágenes", href: "/historias", title: "Historias", testID: "home-dock-historias" }
] as const;

// Atajos del "¿Cómo estás hoy?": tres sentimientos frecuentes que abren Sentir
// con el chip ya elegido. Son de la lista real (`FEELINGS`).
const feelingShortcuts = ["Ansiedad", "Cansancio", "Gratitud"] as const;

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
  const currentUser = useQuery(api.users.current);
  const [isDevotionalOpen, setIsDevotionalOpen] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const appUpdate = useAppUpdate();

  const isReady = state.status === "ready";
  const devotional = isReady ? state.devotional : null;
  const parsed = parseVerseRef(devotional?.verseRef ?? "");
  const cited = useQuery(api.rag.verses.citedForUser, parsed ?? "skip");
  const bibleVersion = cited?.version ?? DEFAULT_BIBLE_VERSION;
  const verseText = cited?.verse?.text;

  const onDevotionalPress = () => {
    if (state.status === "error") {
      retry();
      return;
    }

    if (isReady) setIsDevotionalOpen((isOpen) => !isOpen);
  };

  const onShareDevotional = async () => {
    if (!devotional || !currentUser?.referralCode) return;

    setShareFailed(false);
    const result = await shareContent({
      referralCode: currentUser.referralCode,
      text: buildDevotionalShareText({ ...devotional, version: bibleVersion })
    });

    // Cancelar el share sheet (dismissedAction en iOS, o el usuario simplemente
    // cierra en Android) es un flujo normal: no es error y no se muestra nada.
    if (result.status === "error") setShareFailed(true);
  };

  return (
    <AppScreen contentStyle={styles.screen} style={{ backgroundColor: dark ? color.bg : color.surface }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
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

      {/* Un build viejo de TestFlight se ve como "faltan opciones": se avisa arriba. */}
      {appUpdate.updateAvailable && appUpdate.storeName ? (
        <Pressable
          accessibilityHint={`Abre ${appUpdate.storeName}`}
          accessibilityRole="link"
          onPress={() => void appUpdate.openStore()}
          style={({ pressed }) => [
            styles.feelingCard,
            { backgroundColor: dark ? color.surfaceSunk : color.surfaceAlt, borderColor: color.borderStrong },
            pressed && styles.pressed,
          ]}
          testID="home-update-available"
        >
          <Text style={[styles.feelingTitle, { color: color.ink }]}>Hay una versión nueva</Text>
          <Text style={[styles.feelingDescription, { color: color.inkMuted }]}>
            Tocá para actualizar en {appUpdate.storeName}. Sin actualizar te pueden faltar secciones.
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityHint={state.status === "error" ? "Vuelve a intentar cargar el devocional." : "Abre o cierra el devocional completo."}
        accessibilityRole="button"
        accessibilityState={{ expanded: isDevotionalOpen }}
        onPress={onDevotionalPress}
        style={({ pressed }) => [
          styles.verseCard,
          { backgroundColor: color.surface, borderColor: color.border },
          pressed && state.status !== "loading" && styles.pressed,
        ]}
        testID="home-devotional-toggle"
      >
        <Text style={[styles.overline, { color: color.accent }]}>VERSÍCULO DEL DÍA</Text>
        {state.status === "loading" ? (
          <LoadingState
            message="Preparando la lectura de hoy…"
            onRetry={retry}
            testID="home-devotional-loading"
            variant="inline"
          />
        ) : (
          <Text style={[styles.verse, { color: color.ink }]}>
            {state.status === "error"
              ? "No pudimos preparar tu lectura. Tocá para intentarlo de nuevo."
              : verseText
                ? `“${verseText}”`
                : devotional?.verseRef}
          </Text>
        )}
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
            <Pressable
              accessibilityHint={currentUser?.referralCode ? "Abre las opciones para compartir este devocional." : "Esperá mientras cargamos tu perfil."}
              accessibilityRole="button"
              accessibilityState={{ disabled: !currentUser?.referralCode }}
              disabled={!currentUser?.referralCode}
              onPress={() => void onShareDevotional()}
              style={({ pressed }) => [styles.shareButton, { borderColor: color.borderStrong }, pressed && styles.pressed]}
              testID="home-share-devotional"
            >
              <Text style={[styles.shareButtonLabel, { color: color.ink }]}>Compartir por WhatsApp</Text>
            </Pressable>
            {shareFailed ? (
              <Text style={[styles.shareErrorText, { color: color.danger }]} testID="home-share-devotional-error">
                No pudimos abrir el compartir. Probá de nuevo.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* "¿Cómo estás hoy?" tiene que leerse como algo que se puede pedir:
          atajos de sentimiento y un campo que invita a escribir (beta). */}
      <View
        style={[
          styles.feelingCard,
          { backgroundColor: dark ? color.surfaceSunk : color.surfaceAlt, borderColor: color.border },
        ]}
        testID="home-feeling-card"
      >
        <Text style={[styles.feelingTitle, { color: color.ink }]}>¿Cómo estás hoy?</Text>
        <Text style={[styles.feelingDescription, { color: color.inkMuted }]}>
          Contame qué llevás encima y te preparo un devocional para eso: un versículo, una reflexión y una oración corta.
        </Text>
        <View style={styles.feelingChips}>
          {feelingShortcuts.map((feeling) => (
            <Pressable
              accessibilityHint={`Prepara un devocional para ${feeling.toLowerCase()}.`}
              accessibilityRole="button"
              key={feeling}
              onPress={() => router.push({ pathname: "/sentir", params: { feeling } })}
              style={({ pressed }) => [
                styles.feelingChip,
                { backgroundColor: color.surface, borderColor: color.borderStrong },
                pressed && styles.pressed,
              ]}
              testID={`home-feeling-${feeling}`}
            >
              <Text style={[styles.feelingChipLabel, { color: color.ink }]}>{feeling}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityHint="Abre la lista completa de sentimientos."
            accessibilityRole="button"
            onPress={() => router.push("/sentir")}
            style={({ pressed }) => [styles.feelingChip, { borderColor: color.borderStrong }, pressed && styles.pressed]}
            testID="home-feeling-more"
          >
            <Text style={[styles.feelingChipLabel, { color: color.inkMuted }]}>Ver todos</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityHint="Abre Sentir para escribir cómo te sentís."
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/sentir", params: { escribir: "1" } })}
          style={({ pressed }) => [
            styles.feelingInput,
            { backgroundColor: color.surface, borderColor: color.borderStrong },
            pressed && styles.pressed,
          ]}
          testID="home-feeling-write"
        >
          <Text style={[styles.feelingInputPlaceholder, { color: color.inkFaint }]}>O escribilo con tus palabras…</Text>
          <View style={[styles.feelingInputSend, { backgroundColor: color.ink }]}>
            <Text style={[styles.feelingInputArrow, { color: color.surface }]}>↑</Text>
          </View>
        </Pressable>
      </View>
      </ScrollView>

      {/* Las 4 entradas a los módulos, fijas abajo. Se muestran también en modo
          noche: es la única entrada a los módulos (no hay tab bar). */}
      <View
        accessibilityLabel="¿Qué querés hacer?"
        style={[styles.dock, { backgroundColor: color.surface, borderTopColor: color.border }]}
        testID="home-dock"
      >
        {modules.map((module) => (
          <Pressable
            accessibilityLabel={module.a11y}
            accessibilityRole="button"
            key={module.href}
            onPress={() => router.push(module.href)}
            style={({ pressed }) => [styles.dockItem, pressed && styles.pressed]}
            testID={module.testID}
          >
            <Text numberOfLines={1} style={[styles.dockTitle, { color: color.ink }]}>{module.title}</Text>
            <Text numberOfLines={2} style={[styles.dockCaption, { color: color.inkSoft }]}>{module.caption}</Text>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // El scroll se lleva el padding horizontal; la barra de abajo sangra a los bordes.
  screen: { paddingBottom: 0, paddingHorizontal: 0 },
  scroll: { flex: 1 },
  content: { gap: tokens.space.xxl, paddingBottom: tokens.space.xl, paddingHorizontal: tokens.screenPadding.horizontal },
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
  shareButton: { alignItems: "center", borderRadius: tokens.radius.md, borderWidth: 1, justifyContent: "center", marginTop: tokens.space.xl, paddingVertical: tokens.space.lg },
  shareButtonLabel: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  shareErrorText: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.md, textAlign: "center" },
  feelingCard: { borderRadius: tokens.radius.xl, borderWidth: 1, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  feelingTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  feelingDescription: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  feelingChips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm, marginTop: tokens.space.lg },
  feelingChip: { borderRadius: tokens.radius.pill, borderWidth: 1, paddingHorizontal: tokens.space.md, paddingVertical: tokens.space.sm },
  feelingChipLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Mismo campo redondo con botón de enviar del composer de Voces en el prototipo.
  feelingInput: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    marginTop: tokens.space.md,
    paddingLeft: tokens.space.lg,
    paddingRight: tokens.space.sm,
    paddingVertical: tokens.space.sm,
  },
  feelingInputPlaceholder: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  feelingInputSend: { alignItems: "center", borderRadius: tokens.radius.pill, height: tokens.size.sendButton, justifyContent: "center", width: tokens.size.sendButton },
  feelingInputArrow: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Barra fija: mismo tratamiento que `BottomPanel` (borde de 1px arriba + surface).
  dock: {
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.md,
  },
  dockItem: { alignItems: "center", flex: 1, paddingVertical: tokens.space.xs },
  dockTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  dockCaption: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, textAlign: "center" }
});
