import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { chaptersFor } from "../lib/bibleBooks";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

export type ChapterGridProps = {
  book: string;
  onSelect: (chapter: number) => void;
};

/**
 * Rejilla de capítulos de un libro. Estaba embebida en Preguntar; ahora la
 * comparten Preguntar y Leer, que son el mismo paso del mismo flujo (#112).
 */
export function ChapterGrid({ book, onSelect }: ChapterGridProps) {
  const { color } = useTheme();
  const { width } = useWindowDimensions();

  const cellSize = useMemo(() => {
    const horizontalPadding = tokens.screenPadding.horizontal * 2;
    const gaps = tokens.space.sm * (tokens.grid.chapterColumns - 1);
    return (width - horizontalPadding - gaps) / tokens.grid.chapterColumns;
  }, [width]);

  return (
    <View style={styles.grid}>
      {Array.from({ length: chaptersFor(book) }, (_, index) => index + 1).map((chapter) => (
        <Pressable
          accessibilityLabel={`${book} ${chapter}`}
          accessibilityRole="button"
          key={chapter}
          onPress={() => onSelect(chapter)}
          style={[
            styles.cell,
            {
              backgroundColor: color.surface,
              borderColor: color.border,
              height: cellSize,
              width: cellSize,
            },
          ]}
        >
          <Text style={[styles.label, { color: color.ink }]}>{chapter}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  cell: {
    alignItems: "center",
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: "center",
  },
  label: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
});
