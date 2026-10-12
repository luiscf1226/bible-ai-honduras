import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../../../convex/bibleVersions";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { SearchField } from "../../../src/components/SearchField";
import { usePersistedQuery } from "../../../src/features/offline/usePersistedQuery";
import { formatCrossReference } from "../../../src/features/reading/crossReferences";
import { PassageCard } from "../../../src/features/reading/PassageCard";
import {
  searchTopics,
  topicById,
  topicCountLabel,
  type VerseTopic,
} from "../../../src/features/reading/topicVerses";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Versículos por tema o sentimiento, sin IA: se elige "Ansiedad" o "Paz" y
 * sale una lista curada a mano (`docs/content/versiculos-por-tema.json`). Como
 * el resto de Lectura, es gratis: no consulta cuotas ni muestra paywall.
 *
 * Se puede llegar con un tema ya elegido (`/leer/temas?tema=ansiedad`).
 *
 * Esta pantalla no existe en el prototipo de Claude Design: reusa los chips de
 * Sentir, el buscador de la app (`SearchField`) y la tarjeta de pasajes
 * relacionados (`PassageCard`), sin ningún valor nuevo.
 */
export default function TemasScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ tema?: string | string[] }>();
  const topic = topicById(Array.isArray(params.tema) ? params.tema[0] : params.tema);
  const [query, setQuery] = useState("");
  const currentUser = usePersistedQuery(api.users.current, {}, "users.current");
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;

  const results = useMemo(() => searchTopics(query), [query]);
  const feelings = results.filter((item) => item.kind === "sentimiento");
  const themes = results.filter((item) => item.kind === "tema");

  const back = () => {
    if (topic) {
      router.setParams({ tema: undefined });
      return;
    }
    goBackOrHome();
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader
        accessibilityLabel="Volver"
        onBack={back}
        title={topic?.name ?? "Versículos por tema"}
        titleSize="pick"
      />

      {topic ? (
        <>
          <Text style={[styles.overline, styles.lead, { color: color.accent }]} testID="topic-count">
            {topicCountLabel(topic.verses.length)} · {version}
          </Text>
          <View style={styles.list} testID="topic-verses">
            {topic.verses.map((ref) => (
              <PassageCard item={ref} key={formatCrossReference(ref)} testID="topic-verse" version={version} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.subtitle, styles.lead, { color: color.inkSoft }]}>
            Elegí cómo te sentís o un tema. Son versículos elegidos a mano.
          </Text>
          <SearchField
            accessibilityLabel="Buscar un tema"
            onChangeText={setQuery}
            placeholder="Ansiedad, trabajo, paz…"
            returnKeyType="search"
            testID="topics-search"
            value={query}
          />

          {results.length === 0 ? (
            <Text style={[styles.subtitle, { color: color.inkSoft }]} testID="topics-empty">
              No encontramos ese tema. Probá con otra palabra, como “miedo” o “familia”.
            </Text>
          ) : null}
          <TopicSection title="CÓMO TE SENTÍS" topics={feelings} />
          <TopicSection title="TEMAS" topics={themes} />
        </>
      )}
    </AppScreen>
  );
}

function TopicSection({ title, topics }: { title: string; topics: readonly VerseTopic[] }) {
  const { color } = useTheme();
  if (topics.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.overline, { color: color.accent }]}>{title}</Text>
      <View style={styles.chips}>
        {topics.map((item) => (
          <Pressable
            accessibilityHint="Muestra los versículos de este tema."
            accessibilityRole="button"
            key={item.id}
            onPress={() => router.setParams({ tema: item.id })}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: color.surface, borderColor: color.borderStrong },
              pressed && styles.pressed,
            ]}
            testID={`topic-${item.id}`}
          >
            <Text style={[styles.chipLabel, { color: color.inkMuted }]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  // Pegado al título, alineado con el texto y no con el ‹ (mismo patrón que Recorridos).
  lead: { marginLeft: tokens.size.backButton + tokens.space.md, marginTop: -tokens.space.lg },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  list: { gap: tokens.space.md },
  section: { gap: tokens.space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  // Mismo chip que Sentir (FeelingsComposer), sin selección: tocar abre el tema.
  chip: {
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.sm,
  },
  chipLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.chip.size,
    lineHeight: tokens.type.chip.lineHeight,
  },
  pressed: { opacity: tokens.opacity.pressed },
});
