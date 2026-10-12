import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { usePersistedQuery } from "../../../src/features/offline/usePersistedQuery";
import { parseChapterParams } from "../../../src/features/reading/chapterNavigation";
import {
  CROSS_REFERENCE_ATTRIBUTION,
  crossReferencesFor,
  formatCrossReference,
} from "../../../src/features/reading/crossReferences";
import { PassageCard, useChapterVerses } from "../../../src/features/reading/PassageCard";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Pasajes relacionados de un versículo (#187, N4). Se llega desde la hoja del
 * versículo en el lector ("Relacionados"). Las referencias salen de un índice
 * fijo (OpenBible.info / TSK); el texto de cada pasaje, de la misma Biblia que
 * el lector: la descargada si está en el teléfono, si no, el servidor.
 *
 * Tocar un pasaje abre el lector en ese versículo.
 */
export default function RelacionadosScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[]; verse?: string | string[] }>();
  const chapterRef = parseChapterParams(params);
  const verse = Number(Array.isArray(params.verse) ? params.verse[0] : params.verse);
  const source = chapterRef && Number.isInteger(verse) && verse > 0 ? { ...chapterRef, verse } : null;
  const currentUser = usePersistedQuery(api.users.current, {}, "users.current");
  const version = currentUser?.bibleVersion ?? "RV1909";
  const related = useMemo(() => (source ? crossReferencesFor(source) : []), [source?.book, source?.chapter, source?.verse]);
  const sourceVerses = useChapterVerses(version, source);
  const sourceText = source ? sourceVerses?.find((item) => item.verse === source.verse)?.text : undefined;

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Pasajes relacionados" titleSize="pick" />

      {source ? (
        <View style={styles.source} testID="related-source">
          <Text style={[styles.overline, { color: color.accent }]}>RELACIONADOS CON</Text>
          <Text style={[styles.sourceReference, { color: color.ink }]}>
            {source.book} {source.chapter}:{source.verse}
          </Text>
          {sourceText ? (
            <Text numberOfLines={3} style={[styles.sourceText, { color: color.inkMuted }]}>
              “{sourceText}”
            </Text>
          ) : null}
        </View>
      ) : null}

      {related.length === 0 ? (
        <Text style={[styles.status, { color: color.inkSoft }]} testID="related-empty">
          Este versículo no tiene pasajes relacionados en el índice.
        </Text>
      ) : (
        <View style={styles.list}>
          {related.map((ref) => (
            <PassageCard item={ref} key={formatCrossReference(ref)} testID="related-passage" version={version} />
          ))}
        </View>
      )}

      <Text style={[styles.attribution, { color: color.inkFaint }]}>{CROSS_REFERENCE_ATTRIBUTION}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  source: { gap: tokens.space.xs },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  sourceReference: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  sourceText: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  list: { gap: tokens.space.md },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  attribution: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
