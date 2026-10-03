import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import type { ChapterSpeechState } from "./chapterSpeech";

type ListenBarProps = {
  book: string;
  chapter: number;
  state: Exclude<ChapterSpeechState, { status: "idle" }>;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

/**
 * Control de audio del lector (#157, design/dedicar-y-escuchar.md §Escuchar).
 * Tarjeta al pie de la página, no modal: se sigue leyendo y deslizando
 * mientras suena. Botón redondo `ink` para pausar/seguir, qué versículo suena
 * y una línea de avance del capítulo.
 */
export function ListenBar({ book, chapter, onPause, onResume, onStop, state }: ListenBarProps) {
  const { color } = useTheme();
  const playing = state.status === "playing";
  const progress = state.total > 0 ? (state.index + 1) / state.total : 0;

  return (
    <View
      accessibilityLabel={`${playing ? "Escuchando" : "En pausa"}: ${book} ${chapter}, versículo ${state.verse}`}
      style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}
      testID="reading-listen-bar"
    >
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={playing ? "Pausar" : "Seguir escuchando"}
          accessibilityRole="button"
          onPress={playing ? onPause : onResume}
          style={({ pressed }) => [styles.playButton, { backgroundColor: color.ink }, pressed && styles.pressed]}
          testID={playing ? "reading-listen-pause" : "reading-listen-resume"}
        >
          <Icon color={color.surface} filled={!playing} name={playing ? "pause" : "play"} />
        </Pressable>
        <View style={styles.text}>
          <Text style={[styles.overline, { color: color.accent }]}>{playing ? "ESCUCHANDO" : "EN PAUSA"}</Text>
          <Text numberOfLines={1} style={[styles.label, { color: color.ink }]} testID="reading-listen-verse">
            {book} {chapter} · versículo {state.verse}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dejar de escuchar"
          accessibilityRole="button"
          hitSlop={tokens.space.md}
          onPress={onStop}
          testID="reading-listen-stop"
        >
          <Icon color={color.inkSoft} name="close" />
        </Pressable>
      </View>
      <View style={[styles.track, { backgroundColor: color.border }]}>
        <View style={[styles.fill, { backgroundColor: color.accent, width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: tokens.radius.xxl,
    borderWidth: 1,
    gap: tokens.space.md,
    marginBottom: tokens.space.md,
    marginHorizontal: tokens.screenPadding.horizontal,
    overflow: "hidden",
    paddingBottom: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingTop: tokens.space.md,
  },
  row: { alignItems: "center", flexDirection: "row", gap: tokens.space.md },
  playButton: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    height: tokens.size.audioButton,
    justifyContent: "center",
    width: tokens.size.audioButton,
  },
  text: { flex: 1, gap: tokens.space.xxs },
  overline: {
    fontFamily: tokens.font.sansMedium,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  label: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  track: { borderRadius: tokens.radius.pill, height: tokens.size.audioProgress, overflow: "hidden" },
  fill: { height: tokens.size.audioProgress },
  pressed: { opacity: tokens.opacity.pressed },
});
