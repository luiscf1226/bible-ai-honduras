import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { FilterPills } from "../../../src/components/FilterPills";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { SearchField } from "../../../src/components/SearchField";
import { SavedVerseCard } from "../../../src/features/reading/SavedVerseCard";
import { BOOKMARK_FILTERS, bookmarkFilterFromParam, filterBookmarks, type BookmarkFilter } from "../../../src/features/reading/personalFilters";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Todos los versículos guardados (#166), del más reciente al más viejo. Es la
 * pantalla "Guardados" del prototype con solo la pestaña de versículos: los
 * devocionales y respuestas guardados todavía no existen en el backend.
 *
 * Se puede buscar en la referencia, el texto y la nota, y dejar solo los que
 * tienen nota. Todo se filtra en el teléfono: la nota no viaja a ningún lado.
 */
export default function GuardadosScreen() {
  const { color } = useTheme();
  const currentUser = useQuery(api.users.current);
  const bookmarks = useQuery(api.reading.bookmarks, {});
  const [query, setQuery] = useState("");
  // El chip "Notas" del inicio (#193) entra con `?filtro=con-nota`.
  const params = useLocalSearchParams<{ filtro?: string | string[] }>();
  const [filter, setFilter] = useState<BookmarkFilter>(() => bookmarkFilterFromParam(params.filtro));
  const visible = useMemo(
    () => (bookmarks ? filterBookmarks(bookmarks.items, { query, filter }) : []),
    [bookmarks, filter, query],
  );

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Guardados" titleSize="pick" />

      {bookmarks === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo tus guardados…</Text>
      ) : bookmarks.total === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: color.inkMuted }]}>Todavía no guardas nada aquí</Text>
          <Text style={[styles.emptyBody, { color: color.inkFaint }]}>
            Tocá un versículo mientras leés y elegí “Guardar” para volver a leerlo después.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.tools}>
            <SearchField
              accessibilityLabel="Buscar en tus guardados y notas"
              onChangeText={setQuery}
              placeholder="Buscá un versículo o una nota"
              returnKeyType="search"
              testID="saved-search"
              value={query}
            />
            <FilterPills onSelect={setFilter} options={BOOKMARK_FILTERS} selected={filter} testID="saved-filter" />
          </View>

          {visible.length === 0 ? (
            <Text style={[styles.status, { color: color.inkSoft }]} testID="saved-no-results">
              {filter === "con-nota" && query.trim() === ""
                ? "Todavía no le pusiste nota a ningún guardado. En el lector, tocá un versículo y elegí “Agregar nota”."
                : "No encontramos nada con esa búsqueda en tus guardados."}
            </Text>
          ) : (
            <View style={styles.list}>
              {visible.map((bookmark) => (
                <SavedVerseCard
                  item={bookmark}
                  key={`${bookmark.book}-${bookmark.chapter}-${bookmark.verse}`}
                  referralCode={currentUser?.referralCode}
                />
              ))}
            </View>
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  tools: { gap: tokens.space.md },
  list: { gap: tokens.space.md },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  empty: { alignItems: "center", gap: tokens.space.sm, paddingHorizontal: tokens.space.xl, paddingVertical: tokens.space.xxl },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
});
