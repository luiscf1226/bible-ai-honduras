import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { track } from "../../../lib/telemetry";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { seasonLine } from "../../seasons/seasonCopy";

/**
 * Franja de temporada (#199, design/oleada-ux.md §Temporadas): arriba de la
 * tarjeta del versículo, el nombre en `overline` `accent` y una línea
 * `bodySm` `inkMuted`. La guirnalda de la temporada cuelga de la foto del
 * versículo (`VerseCard`). No es tarjeta ni se toca. Sin temporada no existe
 * (`visible` en `cards/index.ts`), así que el inicio queda como siempre.
 */
export function SeasonStrip() {
  const { color, season } = useTheme();
  const slug = season?.slug;

  useEffect(() => {
    if (slug) track("season_shown");
  }, [slug]);

  if (!season) return null;
  const line = seasonLine(season);

  return (
    <View accessibilityRole="header" style={styles.root} testID="home-season">
      <Text style={[styles.name, { color: color.accent }]}>{season.name}</Text>
      {line ? <Text style={[styles.line, { color: color.inkMuted }]}>{line}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // El `gap` del inicio ya la separa de la tarjeta; alineada con el encabezado.
  root: { gap: tokens.space.xxs },
  name: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  line: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
