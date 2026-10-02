import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../../components/Icon";
import { LoadingState } from "../../../components/LoadingState";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { HOME_ROUTES } from "../homeCards";
import { useTodayDevotional, useTodayVerse } from "../useTodayDevotional";
import { openFromHome } from "./HomeCard";

/**
 * Tarjeta 1, Versículo del día (U1): imagen del devocional con velo y
 * `VERSÍCULO DEL DÍA` encima, el versículo grande, la cita y "Una pausa para
 * hoy". Toda la tarjeta abre `/hoy` (U2). Si falló la carga, tocar reintenta.
 */
export function VerseCard() {
  const { color, dark } = useTheme();
  const { retry, state } = useTodayDevotional();
  const devotional = state.status === "ready" ? state.devotional : null;
  const verse = useTodayVerse(devotional?.verseRef);

  const onPress = () => {
    if (state.status === "error") {
      retry();
      return;
    }
    if (state.status === "ready") openFromHome(HOME_ROUTES.today);
  };

  return (
    <Pressable
      accessibilityHint={
        state.status === "error" ? "Vuelve a intentar cargar el devocional." : "Abre el versículo y el devocional de hoy."
      }
      accessibilityLabel="Versículo del día"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.surface, borderColor: color.border },
        pressed && state.status !== "loading" && styles.pressed,
      ]}
      testID="home-card-verse"
    >
      <View style={[styles.hero, { backgroundColor: color.surfaceSunk }]}>
        {devotional ? (
          <Image
            accessibilityLabel={devotional.imageAlt}
            resizeMode="cover"
            source={{ uri: devotional.imageUrl }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
        {/* Texto sobre la foto: siempre el `surface` claro, también de noche. */}
        <Text style={[styles.overline, { color: tokens.color.surface }]}>VERSÍCULO DEL DÍA</Text>
      </View>

      <View style={styles.body}>
        {state.status === "loading" ? (
          <LoadingState
            message="Preparando la lectura de hoy…"
            onRetry={retry}
            testID="home-devotional-loading"
            variant="inline"
          />
        ) : state.status === "error" ? (
          <Text style={[styles.error, { color: color.inkMuted }]}>
            No pudimos preparar tu lectura. Tocá para intentarlo de nuevo.
          </Text>
        ) : (
          <>
            <Text numberOfLines={5} style={[styles.verse, { color: color.ink }]}>
              {verse.text ? `“${verse.text}”` : devotional?.verseRef}
            </Text>
            <Text style={[styles.reference, { color: color.inkMuted }]}>
              {verse.text ? `${devotional?.verseRef} · ${verse.version}` : verse.version}
            </Text>
            <View style={[styles.footer, { borderTopColor: color.border }]}>
              <Text style={[styles.footerLabel, { color: dark ? color.accent : color.accentDeep }]}>Una pausa para hoy</Text>
              <Icon color={dark ? color.accent : color.accentDeep} name="chevronRight" size="sm" />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.xxl, borderWidth: 1, overflow: "hidden" },
  pressed: { opacity: tokens.opacity.pressed },
  hero: {
    height: tokens.size.verseCardImage,
    justifyContent: "flex-end",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  body: { paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.cardPadding.vertical },
  verse: { fontFamily: tokens.font.serif, fontSize: tokens.type.verseHero.size, lineHeight: tokens.type.verseHero.lineHeight },
  reference: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.md,
  },
  error: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.xs,
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  footerLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
