import { usePaginatedQuery } from "convex/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../convex/_generated/api";
import {
  formatPassage,
  parsePassageQuery,
  searchBookSections,
  type PassageQuery,
} from "../features/reading/bookSearch";
import { highlightSegments } from "../features/reading/highlight";
import { useTheme } from "../theme/ThemeProvider";
import { tokens } from "../theme/tokens";

/**
 * Buscador de pasajes (#112). **Una sola implementación** para las dos
 * superficies que necesitan elegir un pasaje: Leer y Preguntar. Si mañana hace
 * falta en Voces o en Sentir, se llama a este componente; no se copia.
 *
 * Tres caminos, en orden de intención:
 *   1. Referencia escrita ("Juan 3:16", "jn 3:16", "sal 23") → salto directo.
 *   2. Filtro de los 66 libros por nombre o abreviatura, en memoria.
 *   3. Búsqueda full-text en el corpus, paginada y con el término resaltado.
 *
 * Buscar y leer son gratis: este componente no consulta cuotas.
 */

const MIN_TEXT_SEARCH_LENGTH = 3;
const TEXT_SEARCH_PAGE_SIZE = 15;
const TEXT_SEARCH_DEBOUNCE_MS = 300;

export type PassageSearchProps = {
  version: string;
  placeholder?: string;
  /** Tocar un libro (abre el paso de capítulos en la pantalla que llama). */
  onSelectBook: (book: string) => void;
  /** Tocar una referencia o un resultado de texto. */
  onSelectPassage: (passage: PassageQuery) => void;
  /** Contenido opcional debajo de la lista (ej. "preguntar sin pasaje"). */
  footer?: ReactNode;
};

export function PassageSearch({
  version,
  placeholder = "Buscá un libro, “Juan 3:16” o una palabra",
  onSelectBook,
  onSelectPassage,
  footer,
}: PassageSearchProps) {
  const { color } = useTheme();
  const [query, setQuery] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  const trimmed = query.trim();
  const passage = useMemo(() => parsePassageQuery(query), [query]);
  const sections = useMemo(() => searchBookSections(query), [query]);

  // El filtro de libros es instantáneo (array en memoria). La búsqueda de
  // texto sí va al servidor, así que espera a que la persona deje de teclear:
  // sin esto cada letra abre una suscripción nueva de Convex.
  useEffect(() => {
    const shouldSearch = trimmed.length >= MIN_TEXT_SEARCH_LENGTH && passage === null;
    const timer = setTimeout(() => setDebouncedTerm(shouldSearch ? trimmed : ""), TEXT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [passage, trimmed]);

  const textSearch = usePaginatedQuery(
    api.rag.verses.searchText,
    debouncedTerm.length > 0 ? { term: debouncedTerm, version } : "skip",
    { initialNumItems: TEXT_SEARCH_PAGE_SIZE },
  );

  const searching = debouncedTerm.length > 0 && textSearch.status === "LoadingFirstPage";
  const noBooks = sections.length === 0;
  const noVerses = debouncedTerm.length === 0 || (!searching && textSearch.results.length === 0);
  const showEmptyState = trimmed.length > 0 && passage === null && noBooks && noVerses && !searching;

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, { backgroundColor: color.surface, borderColor: color.borderStrong }]}>
        <Text style={[styles.searchIcon, { color: color.inkFaint }]}>⌕</Text>
        <TextInput
          accessibilityLabel="Buscar un pasaje"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={color.inkFaint}
          returnKeyType="search"
          style={[styles.searchInput, { color: color.ink }]}
          testID="passage-search-input"
          value={query}
        />
      </View>

      {passage ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectPassage(passage)}
          style={({ pressed }) => [
            styles.jumpCard,
            { backgroundColor: color.surfaceSunk, borderColor: color.accent },
            pressed && styles.pressed,
          ]}
          testID="passage-search-jump"
        >
          <Text style={[styles.jumpOverline, { color: color.accent }]}>IR DIRECTO A</Text>
          <Text style={[styles.jumpLabel, { color: color.ink }]}>{formatPassage(passage)}</Text>
        </Pressable>
      ) : null}

      {sections.map((section) => (
        <View key={section.testament} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>{section.title.toUpperCase()}</Text>
          <View style={[styles.list, { backgroundColor: color.surface, borderColor: color.border }]}>
            {section.books.map((book, index) => (
              <Pressable
                accessibilityRole="button"
                key={book.name}
                onPress={() => onSelectBook(book.name)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: color.border },
                  index === section.books.length - 1 && styles.rowLast,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.rowLabel, { color: color.ink }]}>{book.name}</Text>
                <Text style={[styles.rowMeta, { color: color.inkFaint }]}>{book.chapters} capítulos</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {searching ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Buscando “{debouncedTerm}” en el texto…</Text>
      ) : null}

      {textSearch.results.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>EN EL TEXTO</Text>
          <View style={styles.resultList}>
            {textSearch.results.map((row) => (
              <Pressable
                accessibilityRole="button"
                key={row._id}
                onPress={() => onSelectPassage({ book: row.book, chapter: row.chapter, verse: row.verse })}
                style={({ pressed }) => [
                  styles.result,
                  { backgroundColor: color.surface, borderColor: color.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.resultRef, { color: color.accent }]}>
                  {row.book} {row.chapter}:{row.verse}
                </Text>
                <Text style={[styles.resultText, { color: color.inkMuted }]}>
                  {highlightSegments(row.text, debouncedTerm).map((segment, index) => (
                    <Text
                      key={index}
                      style={segment.match ? [styles.resultMatch, { color: color.ink }] : undefined}
                    >
                      {segment.text}
                    </Text>
                  ))}
                </Text>
              </Pressable>
            ))}
          </View>
          {textSearch.status === "CanLoadMore" || textSearch.status === "LoadingMore" ? (
            <Pressable
              accessibilityRole="button"
              disabled={textSearch.status === "LoadingMore"}
              onPress={() => textSearch.loadMore(TEXT_SEARCH_PAGE_SIZE)}
              style={({ pressed }) => [
                styles.loadMore,
                { borderColor: color.borderStrong },
                pressed && styles.pressed,
              ]}
              testID="passage-search-load-more"
            >
              <Text style={[styles.loadMoreLabel, { color: color.inkSoft }]}>
                {textSearch.status === "LoadingMore" ? "Cargando…" : "Ver más resultados"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showEmptyState ? (
        <View
          style={[styles.empty, { backgroundColor: color.surfaceSunk, borderColor: color.border }]}
          testID="passage-search-empty"
        >
          <Text style={[styles.emptyTitle, { color: color.ink }]}>Nada con “{trimmed}”</Text>
          <Text style={[styles.emptyText, { color: color.inkSoft }]}>
            Probá con el nombre de un libro (Salmos), su abreviatura (sal, 1co, ap) o una referencia
            completa como “Juan 3:16”.
          </Text>
        </View>
      ) : null}

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.xl },
  pressed: { opacity: tokens.opacity.pressed },
  searchBar: {
    alignItems: "center",
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.md,
  },
  searchIcon: { fontFamily: tokens.font.sans, fontSize: tokens.type.subtitle.size },
  searchInput: { flex: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  jumpCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  jumpOverline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  jumpLabel: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.qaPickTitle.size,
    lineHeight: tokens.type.qaPickTitle.lineHeight,
    marginTop: tokens.space.xs,
  },
  section: { gap: tokens.space.sm },
  sectionTitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  list: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size },
  rowMeta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  status: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  resultList: { gap: tokens.space.sm },
  result: {
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.lg,
  },
  resultRef: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size },
  resultText: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
    marginTop: tokens.space.xs,
  },
  resultMatch: { fontFamily: tokens.font.sansMedium },
  loadMore: {
    borderRadius: tokens.radius.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingVertical: tokens.space.lg,
  },
  loadMoreLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    textAlign: "center",
  },
  empty: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  emptyTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  emptyText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xs,
  },
});
