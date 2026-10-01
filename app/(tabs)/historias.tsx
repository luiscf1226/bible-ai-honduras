import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { AppScreen } from "../../src/components/AppScreen";
import { FilterPills } from "../../src/components/FilterPills";
import { LoadingState } from "../../src/components/LoadingState";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { SearchField } from "../../src/components/SearchField";
import { storiesApi, type StoryCatalogItem } from "../../src/features/stories/contracts";
import {
  filterIllustratedStories,
  filterTextStories,
  type StoryModeFilter,
  type TestamentFilter,
} from "../../src/features/stories/textStoryFilters";
import type { TextStoryListItem } from "../../convex/textStoriesCatalog";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

const listTextStories = makeFunctionReference<"query", Record<string, never>, readonly TextStoryListItem[]>(
  "textStories:list",
);

/**
 * Catálogo de Historias (#145).
 *
 * - Texto (default): gratis, narrativa curada de 2–3 páginas.
 * - Ilustradas: Pro / 1 muestra — sigue `stories.create` + cuota.
 *
 * Filtros: modo, testamento, búsqueda (sin acentos). Las píldoras reusan el
 * patrón visual de Ajustes (`versionPill`); las cards, el del prototipo de Historias.
 */
export default function HistoriasScreen() {
  const { color } = useTheme();
  const [mode, setMode] = useState<StoryModeFilter>("texto");
  const [testament, setTestament] = useState<TestamentFilter>("todos");
  const [query, setQuery] = useState("");
  const [listEpoch, setListEpoch] = useState(0);
  const illustrated = useQuery(storiesApi.stories.list, listEpoch >= 0 ? {} : "skip");
  const textStories = useQuery(listTextStories, listEpoch >= 0 ? {} : "skip");
  const create = useMutation(storiesApi.stories.create);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retryList = () => {
    setListEpoch(-1);
    requestAnimationFrame(() => setListEpoch((value) => (value < 0 ? 0 : value + 1)));
  };

  const filteredText = useMemo(
    () => (textStories ? filterTextStories(textStories, { testament, query }) : []),
    [query, testament, textStories],
  );
  const filteredIllustrated = useMemo(
    () => (illustrated ? filterIllustratedStories(illustrated, { testament, query }) : []),
    [illustrated, query, testament],
  );

  const loading =
    listEpoch < 0 || (mode === "texto" ? textStories === undefined : illustrated === undefined);

  return (
    <AppScreen scroll>
      <ScreenHeader accessibilityLabel="Volver al inicio" style={styles.header} testID="historias-back" />
      <Text style={[styles.title, { color: color.ink }]}>Historias</Text>
      <Text style={[styles.subtitle, { color: color.inkMuted }]}>
        {mode === "texto"
          ? "Leé la Biblia en narrativa. Gratis. Después preguntá el texto en Voces o en Preguntar."
          : "Escenas ilustradas con IA. Incluyen una muestra gratis; el resto es Pro."}
      </Text>

      <FilterPills<StoryModeFilter>
        options={[
          { id: "texto", label: "Texto · gratis" },
          { id: "ilustradas", label: "Ilustradas" },
        ]}
        selected={mode}
        style={styles.filterRow}
        testID="historias-mode"
        onSelect={setMode}
      />
      <FilterPills<TestamentFilter>
        options={[
          { id: "todos", label: "Todos" },
          { id: "antiguo", label: "Antiguo" },
          { id: "nuevo", label: "Nuevo" },
        ]}
        selected={testament}
        style={styles.filterRow}
        testID="historias-testament"
        onSelect={setTestament}
      />

      <SearchField
        accessibilityLabel="Buscar una historia"
        onChangeText={setQuery}
        placeholder="Buscá por título o pasaje"
        returnKeyType="search"
        style={styles.searchBar}
        testID="historias-search"
        value={query}
      />

      {error ? <Text style={[styles.error, { color: color.accentDeep }]}>{error}</Text> : null}

      {loading ? (
        <LoadingState
          message="Cargando historias…"
          onRetry={retryList}
          testID="historias-list-loading"
          variant="inline"
        />
      ) : mode === "texto" ? (
        <TextStoryList color={color} stories={filteredText} />
      ) : (
        <IllustratedStoryList
          color={color}
          create={create}
          creating={creating}
          setCreating={setCreating}
          setError={setError}
          stories={filteredIllustrated}
        />
      )}
    </AppScreen>
  );
}

function TextStoryList({
  color,
  stories,
}: {
  color: ReturnType<typeof useTheme>["color"];
  stories: readonly TextStoryListItem[];
}) {
  if (stories.length === 0) {
    return (
      <Text style={[styles.empty, { color: color.inkSoft }]} testID="historias-text-empty">
        No hay historias con ese filtro. Probá otra búsqueda.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {stories.map((story) => (
        <Pressable
          accessibilityHint="Abre esta historia en texto, gratis."
          accessibilityRole="button"
          key={story.id}
          onPress={() =>
            router.push({ pathname: "/historias/texto/[storyId]", params: { storyId: story.id } })
          }
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: color.surface, borderColor: color.border },
            pressed && { backgroundColor: color.surfaceAlt },
          ]}
          testID={`story-text-${story.id}`}
        >
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: color.ink }]}>{story.title}</Text>
            <Text style={[styles.cardMeta, { color: color.inkSoft }]}>{story.reference}</Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: color.surfaceSunk, color: color.sage }]}>
            {`${story.pageCount} PÁGS · GRATIS`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function IllustratedStoryList({
  color,
  creating,
  create,
  setCreating,
  setError,
  stories,
}: {
  color: ReturnType<typeof useTheme>["color"];
  creating: string | null;
  create: ReturnType<typeof useMutation>;
  setCreating: (storyId: string | null) => void;
  setError: (error: string | null) => void;
  stories: readonly StoryCatalogItem[];
}) {
  if (stories.length === 0) {
    return (
      <Text style={[styles.empty, { color: color.inkSoft }]} testID="historias-illustrated-empty">
        No hay historias ilustradas con ese filtro.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {stories.map((story) => (
        <Pressable
          accessibilityHint="Abre los paneles ilustrados de esta historia"
          accessibilityRole="button"
          key={story.id}
          disabled={creating !== null}
          onPress={() =>
            void (async () => {
              setError(null);
              setCreating(story.id);
              try {
                const result = await create({ storyId: story.id });
                if (!result.allowed) {
                  router.push("/paywall");
                  return;
                }
                router.push({ pathname: "/historias/[storyId]", params: { storyId: story.id } });
              } catch {
                setError("No pudimos preparar esta historia. Intentá de nuevo.");
              } finally {
                setCreating(null);
              }
            })()
          }
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: color.surface, borderColor: color.border },
            pressed && { backgroundColor: color.surfaceAlt },
          ]}
          testID={`story-catalog-${story.id}`}
        >
          <View
            accessibilityElementsHidden
            style={[styles.thumbnail, { backgroundColor: color.surfaceSunk }]}
          />
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: color.ink }]}>{story.title}</Text>
            <Text style={[styles.cardMeta, { color: color.inkSoft }]}>{story.reference}</Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: color.surfaceSunk, color: color.accentDeep }]}>
            {creating === story.id ? "DIBUJANDO…" : `${story.scenes.length} ESCENAS`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: tokens.space.xl },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
  },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.sm,
  },
  filterRow: { marginTop: tokens.space.xl },
  searchBar: { marginTop: tokens.space.lg },
  error: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.lg,
  },
  empty: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.xxl,
  },
  list: { gap: tokens.space.md, marginTop: tokens.space.xxl },
  card: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: tokens.space.lg,
    padding: tokens.space.md,
  },
  thumbnail: {
    borderRadius: tokens.radius.md,
    height: tokens.size.logoMedium,
    width: tokens.size.logoMedium,
  },
  cardCopy: { flex: 1, gap: tokens.space.xs },
  cardTitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
  },
  cardMeta: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  badge: {
    borderRadius: tokens.radius.pill,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: tokens.space.xs,
  },
});
