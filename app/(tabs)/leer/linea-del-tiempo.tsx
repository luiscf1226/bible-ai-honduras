import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import {
  TIMELINE_ERAS,
  bookRange,
  eraFromParam,
  eraOverline,
  eraStories,
  eraVoices,
  timelineBookLabel,
  type TimelineEra,
} from "../../../src/features/reading/timeline";
import { goToVoices } from "../../../src/lib/goToVoices";
import { openPassage, openTextStory } from "../../../src/lib/openPassage";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Línea del tiempo de la Biblia (#201): de la creación a Apocalipsis, época por
 * época. Gratis, dentro de Leer, sin cuotas ni paywall. Los datos van en el
 * bundle (`docs/content/linea-del-tiempo.json`): no consulta Convex y funciona
 * sin conexión.
 *
 * Esta pantalla no existe en el prototipo de Claude Design (regla dura #1).
 * Reusa la tarjeta de Recorridos, el punto de Subrayados, las píldoras de
 * tamaño del lector y los renglones de Guardados, sin ningún valor nuevo.
 * Falta ratificarla en Claude Design.
 */
export default function LineaDelTiempoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ epoca?: string | string[] }>();
  const initialEra = eraFromParam(params.epoca);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(initialEra ? [initialEra.id] : []));
  const scrollRef = useRef<ScrollView>(null);
  const listY = useRef<number | null>(null);
  const eraY = useRef<Record<string, number>>({});
  const scrolled = useRef(false);

  // Desde el lector la línea se abre en la época del capítulo: se despliega y
  // se lleva a la vista una sola vez, cuando ya se midió dónde quedó.
  const scrollToInitial = () => {
    if (!initialEra || scrolled.current || listY.current === null) return;
    const y = eraY.current[initialEra.id];
    if (y === undefined) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, listY.current + y - tokens.space.md), animated: false });
  };

  const toggle = (era: TimelineEra) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(era.id)) next.delete(era.id);
      else next.add(era.id);
      return next;
    });
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} ref={scrollRef} testID="timeline-scroll">
        <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Línea del tiempo" titleSize="pick" />
        <Text style={[styles.subtitle, { color: color.inkSoft }]}>
          De la creación a Apocalipsis, época por época. Tocá una época para ver sus libros, personajes e historias.
        </Text>

        <View
          onLayout={(event) => {
            listY.current = event.nativeEvent.layout.y;
            scrollToInitial();
          }}
          testID="timeline-list"
        >
          {TIMELINE_ERAS.map((era, index) => {
            const open = expanded.has(era.id);
            const last = index === TIMELINE_ERAS.length - 1;
            return (
              <View
                key={era.id}
                onLayout={(event) => {
                  eraY.current[era.id] = event.nativeEvent.layout.y;
                  scrollToInitial();
                }}
                style={styles.eraRow}
                testID={`timeline-era-${era.id}`}
              >
                {/* La línea: un punto por época unido por el borde de las tarjetas. */}
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: open ? color.accent : color.inkFaint }]} />
                  {last ? null : <View style={[styles.railLine, { borderColor: color.border }]} />}
                </View>

                <View style={[styles.card, { backgroundColor: color.surfaceAlt, borderColor: color.border }]}>
                  <Pressable
                    accessibilityHint={open ? "Oculta los detalles de esta época." : "Muestra los libros, personajes e historias de esta época."}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    onPress={() => toggle(era)}
                    style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
                    testID={`timeline-era-toggle-${era.id}`}
                  >
                    <Text style={[styles.overline, { color: color.accent }]}>{eraOverline(era)}</Text>
                    <Text style={[styles.name, { color: color.ink }]}>{era.name}</Text>
                    <Text style={[styles.description, { color: color.inkMuted }]}>{era.summary}</Text>
                  </Pressable>

                  {open ? <EraDetails era={era} /> : null}
                </View>
              </View>
            );
          })}
        </View>

        <Text style={[styles.footnote, { color: color.inkSoft }]}>
          Los años son aproximados y solo aparecen donde hay acuerdo amplio. Donde la fecha se discute, se muestra solo el orden.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

function EraDetails({ era }: { era: TimelineEra }) {
  const { color } = useTheme();
  const voices = eraVoices(era);
  const stories = eraStories(era);
  const notes = era.books.filter((entry) => entry.note);

  return (
    <View style={styles.details} testID={`timeline-details-${era.id}`}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>LIBROS</Text>
        <View style={styles.chips}>
          {era.books.map((entry) => (
            <Pressable
              accessibilityHint="Abre este libro en el lector."
              accessibilityRole="button"
              key={`${entry.book}-${entry.from ?? 0}`}
              onPress={() => openPassage({ book: entry.book, chapter: bookRange(entry).from })}
              style={({ pressed }) => [styles.chip, { borderColor: color.border }, pressed && styles.pressed]}
              testID={`timeline-book-${entry.book}`}
            >
              <Text style={[styles.chipLabel, { color: color.ink }]}>{timelineBookLabel(entry)}</Text>
            </Pressable>
          ))}
        </View>
        {notes.map((entry) => (
          <Text key={`note-${entry.book}`} style={[styles.note, { color: color.inkMuted }]}>
            {entry.book}: {entry.note}
          </Text>
        ))}
      </View>

      {voices.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>EN VOCES</Text>
          {voices.map((voice) => (
            <Pressable
              accessibilityHint={`Abre la conversación con ${voice.name}.`}
              accessibilityRole="button"
              key={voice.slug}
              onPress={() => goToVoices(voice.slug)}
              style={[styles.row, { borderColor: color.border }]}
              testID={`timeline-voice-${voice.slug}`}
            >
              <Text style={[styles.rowLabel, { color: color.ink }]}>Hablar con {voice.name}</Text>
              <Text style={[styles.rowMeta, { color: color.inkMuted }]}>{voice.tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {stories.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: color.inkSoft }]}>HISTORIAS</Text>
          {stories.map((story) => (
            <Pressable
              accessibilityHint="Abre la historia."
              accessibilityRole="button"
              key={story.id}
              onPress={() => openTextStory(story.id)}
              style={[styles.row, { borderColor: color.border }]}
              testID={`timeline-story-${story.id}`}
            >
              <Text style={[styles.rowLabel, { color: color.ink }]}>{story.title}</Text>
              <Text style={[styles.rowMeta, { color: color.inkMuted }]}>{story.reference}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
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
  eraRow: { flexDirection: "row", gap: tokens.space.md },
  // Riel: el punto de Subrayados y una línea del grosor del borde de las tarjetas.
  rail: { alignItems: "center", paddingTop: tokens.cardPadding.vertical + tokens.space.xxs, width: tokens.size.dot },
  dot: { borderRadius: tokens.radius.pill, height: tokens.size.dot, width: tokens.size.dot },
  railLine: { borderLeftWidth: 1, flex: 1, marginTop: tokens.space.xs },
  // Tarjeta de Recorridos; el margen inferior deja correr la línea entre épocas.
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    flex: 1,
    marginBottom: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  cardHeader: { gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  description: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  details: { gap: tokens.space.lg, marginTop: tokens.space.lg },
  section: { gap: tokens.space.sm },
  sectionTitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  // Píldoras: las mismas de tamaño de letra del lector.
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs },
  chip: { borderRadius: tokens.radius.pill, borderWidth: 1, paddingHorizontal: tokens.space.sm, paddingVertical: tokens.space.xxs },
  chipLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  note: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  // Renglones: los de Guardados y Recientes en Leer.
  row: { borderBottomWidth: 1, paddingVertical: tokens.space.sm },
  rowLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  rowMeta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  footnote: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
