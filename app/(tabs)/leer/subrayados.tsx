import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { FilterPills, type FilterPillOption } from "../../../src/components/FilterPills";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { SearchField } from "../../../src/components/SearchField";
import { overlayHighlightPage } from "../../../src/features/offline/mutationQueue";
import { useOfflineSync } from "../../../src/features/offline/OfflineSyncProvider";
import { HighlightCard } from "../../../src/features/reading/HighlightCard";
import { HIGHLIGHT_SWATCHES, highlightSwatch } from "../../../src/features/reading/highlightColors";
import { countByColor, filterHighlights, type HighlightFilter } from "../../../src/features/reading/personalFilters";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Todos los subrayados (#168), del último tocado al primero, con el texto del
 * versículo. Se filtran por color, para quien usa cada color con un sentido
 * propio ("en ámbar marco promesas"), y se buscan por referencia o texto.
 */
export default function SubrayadosScreen() {
  const { color } = useTheme();
  const { pending } = useOfflineSync();
  const highlights = overlayHighlightPage(useQuery(api.reading.highlightsWithText, {}), pending);
  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState<HighlightFilter>("todos");

  const options = useMemo<FilterPillOption<HighlightFilter>[]>(() => {
    const counts = countByColor(highlights?.items ?? []);
    return [
      { id: "todos", label: "Todos" },
      // Solo los colores que se usaron: un filtro que siempre da vacío estorba.
      ...HIGHLIGHT_SWATCHES.filter((swatch) => counts[swatch.key] > 0).map((swatch) => ({
        id: swatch.key,
        label: `${swatch.label} · ${counts[swatch.key]}`,
        dot: highlightSwatch(color, swatch.key),
      })),
    ];
  }, [color, highlights]);

  // Si se quitó el último subrayado de un color, su filtro desaparece: se
  // vuelve a "Todos" en vez de quedar en una lista vacía sin salida.
  const activeColor = options.some((option) => option.id === colorFilter) ? colorFilter : "todos";
  const visible = useMemo(
    () => (highlights ? filterHighlights(highlights.items, { query, color: activeColor }) : []),
    [activeColor, highlights, query],
  );

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Subrayados" titleSize="pick" />

      {highlights === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo tus subrayados…</Text>
      ) : highlights.total === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: color.inkMuted }]}>Todavía no subrayaste nada</Text>
          <Text style={[styles.emptyBody, { color: color.inkFaint }]}>
            Como el resaltador de una Biblia de papel. En el lector, tocá un versículo y elegí un color.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.tools}>
            <SearchField
              accessibilityLabel="Buscar en tus subrayados"
              onChangeText={setQuery}
              placeholder="Buscá un versículo o una palabra"
              returnKeyType="search"
              testID="highlights-search"
              value={query}
            />
            <FilterPills onSelect={setColorFilter} options={options} selected={activeColor} testID="highlights-filter" />
          </View>

          {visible.length === 0 ? (
            <Text style={[styles.status, { color: color.inkSoft }]} testID="highlights-no-results">
              No encontramos nada con esa búsqueda en tus subrayados.
            </Text>
          ) : (
            <View style={styles.list}>
              {visible.map((item) => (
                <HighlightCard item={item} key={`${item.book}-${item.chapter}-${item.verse}`} />
              ))}
            </View>
          )}
        </>
      )}
    </AppScreen>
  );
}

// Mismos valores que `guardados.tsx`.
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
