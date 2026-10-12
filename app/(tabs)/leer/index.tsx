import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../../../convex/bibleVersions";
import { AppScreen } from "../../../src/components/AppScreen";
import { ChapterGrid } from "../../../src/components/ChapterGrid";
import { Chip } from "../../../src/components/Chip";
import { EntryCard } from "../../../src/components/EntryCard";
import { PassageSearch } from "../../../src/components/PassageSearch";
import { ScreenHeader } from "../../../src/components/ScreenHeader";
import { overlaySeparator } from "../../../src/features/offline/mutationQueue";
import { useOfflineSync } from "../../../src/features/offline/OfflineSyncProvider";
import { BookIndex } from "../../../src/features/reading/BookIndex";
import { openPassage } from "../../../src/lib/openPassage";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Pestaña Biblia (#112, #195, #232). Buscar y leer son gratis: esta pantalla
 * no consulta cuotas ni muestra paywall.
 *
 * Orden desde #232 (Fase 3): la búsqueda arriba; debajo, "Seguí leyendo" (el
 * separador si hay, si no el último capítulo, con los recientes como chips);
 * una sola entrada "Planes y recorridos"; y el índice de libros. Guardados,
 * subrayados y separador viven en Mi espacio: antes aparecían tres veces.
 */
export default function LeerScreen() {
  const { color } = useTheme();
  const [book, setBook] = useState<string | null>(null);
  const currentUser = useQuery(api.users.current);
  const progress = useQuery(api.reading.progress, {});
  const recents = useQuery(api.reading.recents, {});
  // Lo hecho sin conexión se ve al instante (#182).
  const { pending } = useOfflineSync();
  const separator = overlaySeparator(useQuery(api.reading.separator, {}), pending);
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;

  // El separador va primero: es lo que la persona dejó a propósito, como la
  // cinta de una Biblia de papel. Si no hay, el último capítulo leído.
  const resume = separator
    ? { overline: "Tu separador", title: `${separator.book} ${separator.chapter}:${separator.verse}`, passage: separator, ribbon: true }
    : progress
      ? { overline: "Seguí leyendo", title: `${progress.book} ${progress.chapter}`, passage: { book: progress.book, chapter: progress.chapter }, ribbon: false }
      : null;
  const recentChips = (recents ?? []).filter(
    (recent) => !resume || recent.book !== resume.passage.book || recent.chapter !== resume.passage.chapter,
  );

  const top = (
    <View style={styles.top}>
      {resume ? (
        <EntryCard
          accessibilityHint="Abre la Biblia donde la dejaste."
          mark={resume.ribbon ? <View style={[styles.ribbon, { backgroundColor: color.accent }]} /> : undefined}
          onPress={() => openPassage(resume.passage)}
          overline={resume.overline}
          testID={resume.ribbon ? "leer-separator" : "leer-resume"}
          title={resume.title}
        />
      ) : null}
      {recentChips.length > 0 ? (
        // Chips en vez de filas: no empujan el índice hacia abajo (#195).
        <View style={styles.chips} testID="leer-recents">
          {recentChips.map((recent) => (
            <Chip
              key={`${recent.book}-${recent.chapter}`}
              label={`${recent.book} ${recent.chapter}`}
              onPress={() => openPassage(recent)}
              serif
              size="sm"
            />
          ))}
        </View>
      ) : null}
      <EntryCard
        chevron
        description="Un año completo, de Génesis a Apocalipsis, por tema, la línea del tiempo y en grupo."
        onPress={() => router.push("/leer/planes")}
        overline="Planes y recorridos"
        testID="leer-plans-entry"
        title="Leer con un rumbo"
      />
    </View>
  );

  return (
    <AppScreen scroll contentStyle={styles.content}>
      {/* Pestaña Biblia (#232): el ‹ solo aparece para volver del capítulo al índice. */}
      <ScreenHeader
        accessibilityLabel="Volver al índice"
        onBack={() => setBook(null)}
        showBack={book !== null}
        title={book ?? "Biblia"}
        titleSize="pick"
      />
      <Text style={[styles.subtitle, book !== null && styles.subtitleUnderBack, { color: color.inkSoft }]}>
        {book ? "Elegí el capítulo." : `Elegí un libro o buscá un pasaje. Texto ${DEFAULT_BIBLE_VERSION}.`}
      </Text>

      {book ? (
        <ChapterGrid book={book} onSelect={(chapter) => openPassage({ book, chapter })} />
      ) : (
        <PassageSearch
          compact
          emptyQueryContent={
            <>
              {top}
              <BookIndex onSelectBook={setBook} />
            </>
          }
          onSelectBook={setBook}
          onSelectPassage={openPassage}
          placeholder="Buscá “Juan 3:16” o una palabra"
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
    marginTop: -tokens.space.lg,
  },
  subtitleUnderBack: { marginLeft: tokens.size.backButton + tokens.space.md },
  top: { gap: tokens.space.md, marginBottom: tokens.space.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  // Cinta del separador: mismo punto que marca "Los de antes" en Sentir, en vertical.
  ribbon: { borderRadius: tokens.radius.pill, height: tokens.space.lg, width: tokens.size.dot },
});
