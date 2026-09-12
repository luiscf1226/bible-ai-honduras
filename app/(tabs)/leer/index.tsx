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
  const recents = useQuery(api.reading.recents, {});
  const bookmarks = useQuery(api.reading.bookmarks, {});
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leer/plan")}
            style={({ pressed }) => [
              styles.planCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-plan-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>PLAN DE LECTURA</Text>
            <Text style={[styles.planLabel, { color: color.ink }]}>Génesis a Apocalipsis en 365 días</Text>
          </Pressable>

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

          {recents && recents.length > 0 ? (
            <View style={styles.savedSection}>
              <Text style={[styles.savedTitle, { color: color.inkSoft }]}>RECIENTES</Text>
              {recents.map((recent) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${recent.book}-${recent.chapter}`}
                  onPress={() => openChapter(recent)}
                  style={[styles.savedRow, { borderColor: color.border }]}
                >
                  <Text style={[styles.savedLabel, { color: color.ink }]}>{recent.book} {recent.chapter}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {bookmarks && bookmarks.length > 0 ? (
            <View style={styles.savedSection}>
              <Text style={[styles.savedTitle, { color: color.inkSoft }]}>GUARDADOS</Text>
              {bookmarks.map((bookmark) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${bookmark.book}-${bookmark.chapter}-${bookmark.verse}`}
                  onPress={() => openChapter(bookmark)}
                  style={[styles.savedRow, { borderColor: color.border }]}
                >
                  <Text style={[styles.savedLabel, { color: color.ink }]}>
                    {bookmark.book} {bookmark.chapter}:{bookmark.verse}
                  </Text>
                </Pressable>
              ))}
            </View>
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
  planCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  planOverline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  planLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight, marginTop: tokens.space.xs },
  savedSection: { gap: tokens.space.sm },
  savedTitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  savedRow: { borderBottomWidth: 1, paddingVertical: tokens.space.sm },
  savedLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
});
