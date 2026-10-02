import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { formatCitation } from "../lib/citation";
import { openPassage } from "../lib/openPassage";
import { track } from "../lib/telemetry";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

type CitationFrom = "qa" | "feelings" | "voices" | "today";

type CitationLinkProps = {
  book: string;
  chapter: number;
  verse?: number;
  version?: string;
  /** Desde qué pantalla se abre, para el embudo (`citation_opened`). */
  from: CitationFrom;
  /**
   * `inline`: la cita dentro de una burbuja de respuesta (Preguntar).
   * `block`: la cita debajo de un versículo destacado (devocional de Sentir).
   * Cada una conserva el estilo que esa pantalla ya tenía.
   */
  variant?: "inline" | "block";
  /** Ajuste de la pantalla que la usa (p. ej. `/hoy` la alinea con el versículo, sin sangría). */
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Cita bíblica tocable (#192): abre el lector en ese capítulo con el
 * versículo elegido. Transversal con un solo dueño (regla dura #3): ninguna
 * pantalla arma su propia cita tocable.
 */
export function CitationLink({ book, chapter, verse, version, from, variant = "inline", style, testID }: CitationLinkProps) {
  const { color } = useTheme();

  return (
    <Text
      accessibilityHint="Abre el capítulo en el lector."
      accessibilityRole="link"
      onPress={() => {
        track("citation_opened", from === "today" ? undefined : from);
        openPassage({ book, chapter, verse });
      }}
      style={[
        variant === "inline" ? [styles.inline, { color: color.inkFaint }] : [styles.block, { color: color.inkSoft }],
        style,
      ]}
      testID={testID}
    >
      {formatCitation({ book, chapter, verse, version })}
    </Text>
  );
}

const styles = StyleSheet.create({
  inline: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, marginTop: tokens.space.sm },
  block: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    paddingLeft: tokens.space.lg,
  },
});
