import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../../components/Icon";
import { LoadingState } from "../../../components/LoadingState";
import { SeasonGarland } from "../../seasons/SeasonGarland";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { HOME_ROUTES } from "../homeCards";
import { useTodayDevotional, useTodayVerse } from "../useTodayDevotional";
import { openFromHome } from "./HomeCard";

/**
 * Tarjeta 1, Versículo del día (U1b): la imagen del devocional ocupa toda la
 * tarjeta, con `imageScrim`, y encima, abajo: `VERSÍCULO DEL DÍA`, el
 * versículo en serif `verse` y una fila con la cita y "Una pausa para hoy".
 * Es la única tarjeta que se estira: se queda con el alto que sobra para que
 * el inicio entre en una pantalla (mínimo `size.verseCardImage`). Toda la
 * tarjeta abre `/hoy` (U2). Si falló la carga, tocar reintenta.
 */
export function VerseCard() {
  const { color } = useTheme();
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
        { backgroundColor: color.surfaceSunk, borderColor: color.border },
        pressed && state.status !== "loading" && styles.pressed,
      ]}
      testID="home-card-verse"
    >
      {devotional ? (
        <>
          <Image
            accessibilityLabel={devotional.imageAlt}
            resizeMode="cover"
            source={{ uri: devotional.imageUrl }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.imageScrim }]} />
          {/* Temporada (#199): la guirnalda cuelga del borde de arriba de la foto. */}
          <SeasonGarland />
        </>
      ) : null}

      {state.status === "loading" ? (
        <LoadingState message="Preparando la lectura de hoy…" onRetry={retry} testID="home-devotional-loading" variant="inline" />
      ) : state.status === "error" ? (
        <Text style={[styles.error, { color: color.inkMuted }]}>No pudimos preparar tu lectura. Tocá para intentarlo de nuevo.</Text>
      ) : (
        // Texto sobre la foto: siempre el `surface` claro, también de noche.
        <>
          <Text style={[styles.overline, { color: tokens.color.surface }]}>VERSÍCULO DEL DÍA</Text>
          <Text numberOfLines={4} style={[styles.verse, { color: tokens.color.surface }]}>
            {verse.text ? `“${verse.text}”` : devotional?.verseRef}
          </Text>
          <View style={styles.footer}>
            <Text numberOfLines={1} style={[styles.reference, { color: tokens.color.surface }]}>
              {verse.text ? `${devotional?.verseRef} · ${verse.version}` : verse.version}
            </Text>
            <Text style={[styles.footerLabel, { color: tokens.color.surface }]}>Una pausa para hoy</Text>
            <Icon color={tokens.color.surface} name="chevronRight" size="sm" />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    flex: 1,
    justifyContent: "flex-end",
    minHeight: tokens.size.verseCardImage,
    overflow: "hidden",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  verse: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.verse.size,
    lineHeight: tokens.type.verse.lineHeight,
    marginTop: tokens.space.xs,
  },
  footer: { alignItems: "center", flexDirection: "row", gap: tokens.space.xs, marginTop: tokens.space.sm },
  reference: {
    flex: 1,
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    opacity: tokens.opacity.imageMuted,
  },
  error: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  footerLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
