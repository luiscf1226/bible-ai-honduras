import { useQuery } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { DEFAULT_BIBLE_VERSION } from "../../convex/bibleVersions";
import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { ChapterGrid } from "../../src/components/ChapterGrid";
import { PassageSearch } from "../../src/components/PassageSearch";
import { ScreenHeader, goBackOrHome } from "../../src/components/ScreenHeader";
import type { PassageQuery } from "../../src/features/reading/bookSearch";
import { goToChat } from "../../src/lib/goToChat";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

export { goToChat } from "../../src/lib/goToChat";

export default function PreguntarScreen() {
  const { color } = useTheme();
  const [book, setBook] = useState<string | null>(null);
  const currentUser = useQuery(api.users.current);
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;
  const openPassage = (passage: PassageQuery) => goToChat(passage);

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader
        accessibilityLabel="Volver"
        onBack={() => (book ? setBook(null) : goBackOrHome())}
        title={book ?? "¿Sobre qué pasaje?"}
        titleSize="pick"
      />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>
        {book ? "Elegí el capítulo." : "Buscá un libro, una cita o una palabra del texto."}
      </Text>

      {book ? (
        <ChapterGrid book={book} onSelect={(chapter) => goToChat({ book, chapter })} />
      ) : (
        <PassageSearch
          footer={
            <Pressable
              accessibilityRole="button"
              onPress={() => goToChat({})}
              style={[styles.freeButton, { borderColor: color.borderStrong }]}
            >
              <Text style={[styles.freeButtonLabel, { color: color.inkSoft }]}>Prefiero preguntar directo, sin elegir pasaje</Text>
            </Pressable>
          }
          onSelectBook={setBook}
          onSelectPassage={openPassage}
          version={version}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
    marginTop: -tokens.space.lg,
  },
  freeButton: {
    borderRadius: tokens.radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingVertical: tokens.cardPadding.vertical,
  },
  freeButtonLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, textAlign: "center" },
});
