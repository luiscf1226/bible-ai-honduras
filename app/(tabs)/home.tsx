import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";

import { AppScreen } from "../../src/components/AppScreen";
import { Brand } from "../../src/components/Brand";
import { Icon } from "../../src/components/Icon";
import { visibleHomeCards } from "../../src/features/home/cards";
import { greetingFor, hondurasDate, hondurasHour } from "../../src/features/home/homeCards";
import { hondurasToday } from "../../src/features/widget/verseWidget";
import { useAppUpdate } from "../../src/hooks/useAppUpdate";
import { subscribeToDailyReminderTaps } from "../../src/lib/dailyReminder";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/**
 * Inicio en tarjetas (#193, design/oleada-ux.md §U1). Cada módulo dice qué
 * ofrece en su tarjeta; el orden y el contenido viven en
 * `src/features/home/` para que esta pantalla no crezca con cada tarjeta.
 */
export default function HomeScreen() {
  const { color, dark, season } = useTheme();
  const appUpdate = useAppUpdate();

  // El widget del versículo del día (#170) abre el inicio con `?devocional=1`:
  // ahora el versículo tiene su pantalla (#194), así que se sigue de largo a `/hoy`.
  const params = useLocalSearchParams<{ devocional?: string | string[] }>();
  const openFromWidget = (Array.isArray(params.devocional) ? params.devocional[0] : params.devocional) === "1";
  useEffect(() => {
    if (!openFromWidget) return;
    router.setParams({ devocional: undefined });
    router.push("/hoy" as Href);
  }, [openFromWidget]);

  // Tocar el aviso diario abre `/hoy` (#194). El inicio es la primera pantalla
  // con sesión, así que acá se atiende también el arranque desde el aviso.
  useEffect(() => subscribeToDailyReminderTaps((pathname) => router.push(pathname as Href)), []);

  const cards = visibleHomeCards({ dateKey: hondurasToday(), season });

  return (
    <AppScreen contentStyle={styles.screen} style={{ backgroundColor: dark ? color.bg : color.surface }}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Un build viejo de TestFlight se ve como "faltan opciones": se avisa arriba de todo. */}
        {appUpdate.updateAvailable && appUpdate.storeName ? (
          <Pressable
            accessibilityHint={`Abre ${appUpdate.storeName}`}
            accessibilityRole="link"
            onPress={() => void appUpdate.openStore()}
            style={({ pressed }) => [
              styles.update,
              { backgroundColor: color.surfaceSunk, borderColor: color.borderStrong },
              pressed && styles.pressed,
            ]}
            testID="home-update-available"
          >
            <Icon color={color.accent} name="refresh" size="md" />
            <View style={styles.updateText}>
              <Text style={[styles.updateTitle, { color: color.ink }]}>Hay una versión nueva</Text>
              <Text style={[styles.updateBody, { color: color.inkMuted }]}>
                Tocá para actualizar en {appUpdate.storeName}. Sin actualizar te pueden faltar secciones.
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.header}>
          <View style={styles.identity}>
            <Brand size="small" />
            <View style={styles.identityText}>
              <Text style={[styles.date, { color: color.inkSoft }]}>{hondurasDate()}</Text>
              <Text style={[styles.greeting, { color: color.ink }]}>{greetingFor(hondurasHour())}</Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Ajustes"
            accessibilityRole="button"
            hitSlop={tokens.space.xs}
            onPress={() => router.push("/ajustes")}
            style={({ pressed }) => [
              styles.settingsButton,
              { backgroundColor: color.surface, borderColor: color.borderStrong },
              pressed && styles.pressed,
            ]}
            testID="home-settings"
          >
            <Icon color={color.inkMuted} name="sun" size="md" />
          </Pressable>
        </View>

        {cards.map(({ Component, id }) => (
          <Component key={id} />
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // El scroll se lleva el padding horizontal.
  screen: { paddingBottom: 0, paddingHorizontal: 0 },
  scroll: { flex: 1 },
  content: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl, paddingHorizontal: tokens.screenPadding.horizontal },
  pressed: { opacity: tokens.opacity.pressed },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: tokens.space.xs,
    marginTop: tokens.space.sm,
  },
  identity: { alignItems: "center", flexDirection: "row", flex: 1, gap: tokens.space.md },
  identityText: { flex: 1 },
  settingsButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    height: tokens.size.logoSmall,
    justifyContent: "center",
    width: tokens.size.logoSmall,
  },
  date: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  greeting: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    marginTop: tokens.space.xs,
  },
  update: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    marginTop: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  updateText: { flex: 1 },
  updateTitle: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.subtitle.lineHeight },
  updateBody: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
