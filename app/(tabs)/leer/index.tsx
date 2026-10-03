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
import { overlayBookmarkPage, overlayHighlightPage, overlaySeparator } from "../../../src/features/offline/mutationQueue";
import { useOfflineSync } from "../../../src/features/offline/OfflineSyncProvider";
import { BookIndex } from "../../../src/features/reading/BookIndex";
import { BEGINNER_PLAN_ID } from "../../../src/features/reading/annualPlans";
import { highlightSwatch } from "../../../src/features/reading/highlightColors";
import { SavedVerseCard } from "../../../src/features/reading/SavedVerseCard";
import { SAVED_PREVIEW_COUNT, seeAllLabel } from "../../../src/features/reading/savedVerses";
import { openPassage, openReadingPlan, openTimeline } from "../../../src/lib/openPassage";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Entrada del módulo de Lectura (#112). Buscar y leer son gratis: esta
 * pantalla no consulta cuotas ni muestra paywall.
 *
 * Desde #195 (U3) la primera vista es el índice de una Biblia de papel
 * (`BookIndex`); la búsqueda queda como campo compacto arriba del índice.
 */
export default function LeerScreen() {
  const { color } = useTheme();
  const [book, setBook] = useState<string | null>(null);
  const currentUser = useQuery(api.users.current);
  const progress = useQuery(api.reading.progress, {});
  const recents = useQuery(api.reading.recents, {});
  // Lo hecho sin conexión se ve al instante (#182).
  const { pending } = useOfflineSync();
  const bookmarks = overlayBookmarkPage(useQuery(api.reading.bookmarks, { limit: SAVED_PREVIEW_COUNT }), pending);
  const separator = overlaySeparator(useQuery(api.reading.separator, {}), pending);
  const highlights = overlayHighlightPage(
    useQuery(api.reading.highlightsWithText, { limit: SAVED_PREVIEW_COUNT }),
    pending,
  );
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;
  const seeAll = bookmarks ? seeAllLabel(bookmarks.total) : null;
  const seeAllHighlights = highlights ? seeAllLabel(highlights.total) : null;

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
        {book ? "Elegí el capítulo." : `Elegí un libro o buscá un pasaje. Texto ${DEFAULT_BIBLE_VERSION}.`}
      </Text>

      {book ? (
        <ChapterGrid book={book} onSelect={(chapter) => openPassage({ book, chapter })} />
      ) : (
        <>
          {/* El separador va primero: es lo que la persona dejó a propósito, como
              la cinta de una Biblia de papel. Reusa la tarjeta de "Seguí leyendo". */}
          {separator ? (
            <Pressable
              accessibilityHint="Abre la Biblia donde dejaste tu separador."
              accessibilityRole="button"
              onPress={() => openPassage(separator)}
              style={({ pressed }) => [
                styles.resumeCard,
                { backgroundColor: color.surfaceAlt, borderColor: color.border },
                pressed && styles.pressed,
              ]}
              testID="leer-separator"
            >
              <View style={styles.separatorHeader}>
                <View style={[styles.separatorRibbon, { backgroundColor: color.accent }]} />
                <Text style={[styles.resumeOverline, { color: color.accent }]}>TU SEPARADOR</Text>
              </View>
              <Text style={[styles.resumeLabel, { color: color.ink }]}>
                {separator.book} {separator.chapter}:{separator.verse}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityHint="Abre el plan de un año pensado para quien nunca leyó la Biblia completa."
            accessibilityRole="button"
            onPress={() => openReadingPlan(BEGINNER_PLAN_ID)}
            style={({ pressed }) => [
              styles.planCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-beginner-plan-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>PARA EMPEZAR · 365 DÍAS</Text>
            <Text style={[styles.planLabel, { color: color.ink }]}>Toda la Biblia en un año, un poco de cada parte</Text>
            <Text style={[styles.planDescription, { color: color.inkMuted }]}>
              Cada día: Antiguo Testamento, Nuevo Testamento y Salmos o Proverbios.
            </Text>
          </Pressable>

          <View style={styles.cardRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leer/plan")}
            style={({ pressed }) => [
              styles.planCard,
              styles.halfCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-plan-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>PLAN DE LECTURA</Text>
            <Text style={[styles.halfLabel, { color: color.ink }]}>De Génesis a Apocalipsis</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/leer/recorridos")}
            style={({ pressed }) => [
              styles.planCard,
              styles.halfCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-journeys-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>RECORRIDOS</Text>
            <Text style={[styles.halfLabel, { color: color.ink }]}>Lecturas cortas por tema</Text>
          </Pressable>
          </View>

          {/* Línea del tiempo (#201): misma tarjeta que Recorridos. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => openTimeline()}
            style={({ pressed }) => [
              styles.planCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-timeline-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>LÍNEA DEL TIEMPO</Text>
            <Text style={[styles.planLabel, { color: color.ink }]}>Dónde cae cada libro, de la creación a Apocalipsis</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/grupos")}
            style={({ pressed }) => [
              styles.planCard,
              { backgroundColor: color.surfaceAlt, borderColor: color.border },
              pressed && styles.pressed,
            ]}
            testID="leer-groups-entry"
          >
            <Text style={[styles.planOverline, { color: color.accent }]}>EN GRUPO</Text>
            <Text style={[styles.planLabel, { color: color.ink }]}>Un plan con tu familia o tu célula</Text>
          </Pressable>

          {progress ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openPassage({ book: progress.book, chapter: progress.chapter })}
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
              {/* Chips en vez de filas: no empujan el índice hacia abajo (#195). */}
              <View style={styles.chips}>
                {recents.map((recent) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${recent.book}-${recent.chapter}`}
                    onPress={() => openPassage(recent)}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: color.surface, borderColor: color.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipLabel, { color: color.ink }]}>{recent.book} {recent.chapter}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <PassageSearch
            compact
            emptyQueryContent={<BookIndex onSelectBook={setBook} />}
            onSelectBook={setBook}
            onSelectPassage={openPassage}
            placeholder="Buscá “Juan 3:16” o una palabra"
            version={version}
          />

          {/* Solo los 3 más recientes: antes la lista crecía sin límite y
              empujaba el buscador hacia abajo (#166). */}
          {bookmarks && bookmarks.total > 0 ? (
            <View style={styles.savedSection}>
              <View style={styles.savedHeader}>
                <Text style={[styles.savedTitle, { color: color.inkSoft }]}>GUARDADOS</Text>
                {seeAll ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={tokens.space.sm}
                    onPress={() => router.push("/leer/guardados")}
                    testID="leer-saved-see-all"
                  >
                    <Text style={[styles.seeAll, { color: color.accent }]}>{seeAll}</Text>
                  </Pressable>
                ) : null}
              </View>
              {bookmarks.items.map((bookmark) => (
                <SavedVerseCard
                  item={bookmark}
                  key={`${bookmark.book}-${bookmark.chapter}-${bookmark.verse}`}
                  referralCode={currentUser?.referralCode}
                />
              ))}
            </View>
          ) : null}

          {/* Igual que Guardados: los 3 últimos y "Ver todos (N)" a la pantalla
              Subrayados, que filtra por color. */}
          {highlights && highlights.total > 0 ? (
            <View style={styles.savedSection} testID="leer-highlights">
              <View style={styles.savedHeader}>
                <Text style={[styles.savedTitle, { color: color.inkSoft }]}>SUBRAYADOS</Text>
                {seeAllHighlights ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={tokens.space.sm}
                    onPress={() => router.push("/leer/subrayados")}
                    testID="leer-highlights-see-all"
                  >
                    <Text style={[styles.seeAll, { color: color.accent }]}>{seeAllHighlights}</Text>
                  </Pressable>
                ) : null}
              </View>
              {highlights.items.map((highlight) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${highlight.book}-${highlight.chapter}-${highlight.verse}`}
                  onPress={() => openPassage(highlight)}
                  style={[styles.savedRow, styles.highlightRow, { borderColor: color.border }]}
                >
                  <View style={[styles.highlightDot, { backgroundColor: highlightSwatch(color, highlight.color) }]} />
                  <Text style={[styles.savedLabel, { color: color.ink }]}>
                    {highlight.book} {highlight.chapter}:{highlight.verse}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

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
  planDescription: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  // Cinta del separador: mismo punto que marca "Los de antes" en Sentir, en
  // vertical. Ancho y alto salen de tokens de tamaño existentes.
  separatorHeader: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm },
  separatorRibbon: { borderRadius: tokens.radius.pill, height: tokens.space.lg, width: tokens.size.dot },
  cardRow: { flexDirection: "row", gap: tokens.space.md },
  halfCard: { flex: 1 },
  halfLabel: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
    marginTop: tokens.space.xs,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.xs,
  },
  chipLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  planLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight, marginTop: tokens.space.xs },
  savedSection: { gap: tokens.space.sm },
  savedHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  seeAll: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  savedTitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  savedRow: { borderBottomWidth: 1, paddingVertical: tokens.space.sm },
  savedLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  // Subrayados: mismo renglón que Guardados con el punto del color elegido.
  highlightRow: { alignItems: "center", flexDirection: "row", gap: tokens.space.sm },
  highlightDot: { borderRadius: tokens.radius.pill, height: tokens.size.dot, width: tokens.size.dot },
});
