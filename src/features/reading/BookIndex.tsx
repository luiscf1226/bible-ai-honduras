import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FilterPills } from "../../components/FilterPills";
import type { Testament } from "../../lib/bibleBooks";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { booksOfSection, sectionsForTestament, splitInColumns } from "./bookSections";

const TESTAMENTS = [
  { id: "antiguo", label: "Antiguo Testamento" },
  { id: "nuevo", label: "Nuevo Testamento" },
] as const;

/**
 * Índice tipo Biblia física (#195, U3): Antiguo / Nuevo Testamento y los
 * libros por sección, en dos columnas. Tocar un libro abre su `ChapterGrid`.
 */
export function BookIndex({ initialTestament = "antiguo", onSelectBook }: {
  initialTestament?: Testament;
  onSelectBook: (book: string) => void;
}) {
  const { color } = useTheme();
  const [testament, setTestament] = useState<Testament>(initialTestament);

  return (
    <View style={styles.container} testID="leer-book-index">
      <FilterPills onSelect={setTestament} options={TESTAMENTS} selected={testament} testID="leer-testament" />
      {sectionsForTestament(testament).map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.overline, { color: color.accent }]}>{section.title.toUpperCase()}</Text>
          <View style={styles.columns}>
            {splitInColumns(booksOfSection(section)).map((column, columnIndex) => (
              <View key={columnIndex} style={styles.column}>
                {column.map((book) => (
                  <Pressable
                    accessibilityHint={`${book.chapters} ${book.chapters === 1 ? "capítulo" : "capítulos"}`}
                    accessibilityRole="button"
                    key={book.name}
                    onPress={() => onSelectBook(book.name)}
                    style={({ pressed }) => [styles.row, { borderBottomColor: color.border }, pressed && styles.pressed]}
                    testID={`leer-book-${book.name}`}
                  >
                    <Text numberOfLines={1} style={[styles.book, { color: color.ink }]}>
                      {book.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.xl },
  section: { gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  columns: { flexDirection: "row", gap: tokens.space.xl },
  column: { flex: 1 },
  row: { borderBottomWidth: 1, paddingVertical: tokens.space.sm },
  book: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  pressed: { opacity: tokens.opacity.pressed },
});
