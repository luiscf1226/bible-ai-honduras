import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../../../convex/bibleVersions";
import { AppScreen } from "../../../src/components/AppScreen";
import { ChapterGrid } from "../../../src/components/ChapterGrid";
import { PassageSearch } from "../../../src/components/PassageSearch";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import type { PassageQuery } from "../../../src/features/reading/bookSearch";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Entrada del módulo de Lectura (#112). Buscar y leer son gratis: esta
 * pantalla no consulta cuotas ni muestra paywall.
 */
export function openChapter(passage: PassageQuery) {
  router.push({
    pathname: "/leer/[book]/[chapter]",
    params: {
      book: passage.book,
      chapter: String(passage.chapter),
      ...(passage.verse === undefined ? {} : { verse: String(passage.verse) }),
    },
  });
}

export default function LeerScreen() {
  const { color } = useTheme();
  const [book, setBook] = useState<string | null>(null);
  const currentUser = useQuery(api.users.current);
  const progress = useQuery(api.reading.progress, {});
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;

  const back = () => {
    if (book) {
      setBook(null);
      return;
    }
    goBackOrHome();
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader
        accessibilityLabel="Volver"
        onBack={back}
        title={book ?? "Leer la Biblia"}
        titleSize="pick"
      />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>
        {book ? "Elegí el capítulo." : `Buscá un pasaje o una palabra. Texto ${DEFAULT_BIBLE_VERSION}.`}
      </Text>

      {book ? (
        <ChapterGrid book={book} onSelect={(chapter) => openChapter({ book, chapter })} />
      ) : (
        <>
          {progress ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openChapter({ book: progress.book, chapter: progress.chapter })}
              style={({ pressed }) => [
                styles.resumeCard,
                { backgroundColor: color.surfaceAlt, borderColor: color.border },
                pressed && styles.pressed,
              ]}
              testID="leer-resume"
            >
              <Text style={[styles.resumeOverline, { color: color.accent }]}>SEGUÍ LEYENDO</Text>
              <Text style={[styles.resumeLabel, { color: color.ink }]}>
                {progress.book} {progress.chapter}
              </Text>
            </Pressable>
          ) : null}

          <PassageSearch
            onSelectBook={setBook}
            onSelectPassage={openChapter}
            version={version}
          />
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
    marginTop: -tokens.space.lg,
  },
  resumeCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  resumeOverline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  resumeLabel: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    marginTop: tokens.space.xs,
  },
});
