import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../convex/_generated/api";
import { isValidYearInWordYear, yearInWordYear } from "../convex/yearInWordCore";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { ScreenHeader } from "../src/components/ScreenHeader";
import {
  isYearInWordEmpty,
  shareYearInWord,
  topHighlightCaption,
  topHighlightReference,
  yearInWordRows,
  yearInWordTitle,
} from "../src/features/personal/yearInWord";
import { openPassage } from "../src/lib/openPassage";
import { hondurasToday } from "../src/lib/reminderDates";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

/**
 * "Tu año en la Palabra" (#183): resumen de solo lectura. Mi espacio lo ofrece
 * del 1 de diciembre al 31 de enero, pero la ruta abre siempre (QA y quien
 * quiera verlo antes). `?anio=2025` muestra otro año.
 *
 * No está en el prototipo: se arma solo con piezas que ya existen (la tarjeta
 * y el renglón de Mi espacio, la tarjeta de versículo de Guardados y
 * AppButton), con cero tokens nuevos. Sin confetti, sin rachas, sin ranking.
 */
export default function TuAnoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ anio?: string }>();
  const requested = Number(params.anio);
  const year = isValidYearInWordYear(requested) ? requested : yearInWordYear(hondurasToday());
  const summary = useQuery(api.yearInWord.summary, { year });
  const currentUser = useQuery(api.users.current);
  const referralCode = currentUser?.referralCode;
  const top = summary?.topHighlight ?? null;

  const share = () => {
    if (!summary || !referralCode) return;
    void shareYearInWord({ summary, referralCode });
  };

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader accessibilityLabel="Volver" title={yearInWordTitle(year)} />

      {summary === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Contando tu año…</Text>
      ) : summary === null || isYearInWordEmpty(summary) ? (
        <View style={styles.empty} testID="tu-ano-vacio">
          <Text style={[styles.emptyTitle, { color: color.inkMuted }]}>Este año todavía no hay nada aquí</Text>
          <Text style={[styles.emptyBody, { color: color.inkFaint }]}>
            Cuando leás un capítulo, marqués un día del plan o guardés un versículo, aparece en este resumen.
          </Text>
          <AppButton onPress={() => router.push("/leer")} style={styles.emptyButton} testID="tu-ano-ir-a-leer" variant="secondary">
            Ir a Leer
          </AppButton>
        </View>
      ) : (
        <>
          <Text style={[styles.intro, { color: color.inkMuted }]}>
            Lo que leíste, cumpliste del plan, guardaste y subrayaste en {year}. Solo vos lo ves.
          </Text>

          <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="tu-ano-cuentas">
            {yearInWordRows(summary).map((row, index) => (
              <View
                accessibilityLabel={`${row.label}: ${row.value}`}
                key={row.id}
                style={[styles.row, index > 0 && styles.rowDivider, index > 0 && { borderTopColor: color.border }]}
                testID={`tu-ano-${row.id}`}
              >
                <Text style={[styles.rowLabel, { color: color.ink }]}>{row.label}</Text>
                <Text style={[styles.count, { color: row.value > 0 ? color.accent : color.inkFaint }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {top ? (
            <Pressable
              accessibilityHint="Abre el versículo en el lector."
              accessibilityRole="button"
              onPress={() => openPassage(top)}
              style={({ pressed }) => [
                styles.card,
                styles.verseCard,
                { backgroundColor: color.surface, borderColor: color.border },
                pressed && styles.pressed,
              ]}
              testID="tu-ano-subrayado"
            >
              <Text style={[styles.kind, { color: color.accent }]}>Lo que más subrayaste</Text>
              {top.text !== null ? (
                <Text style={[styles.verse, { color: color.ink }]}>“{top.text}”</Text>
              ) : (
                <Text style={[styles.missing, { color: color.inkSoft }]}>
                  Este versículo todavía no está en {top.version}. Tocá para abrir el capítulo.
                </Text>
              )}
              <View style={[styles.footer, { borderTopColor: color.border }]}>
                <Text numberOfLines={1} style={[styles.meta, { color: color.inkSoft }]}>
                  {topHighlightReference(top)} · {topHighlightCaption(top)}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.shareBlock}>
            <AppButton disabled={!referralCode} onPress={share} testID="tu-ano-compartir" variant="secondary">
              Compartir mi año
            </AppButton>
            <Text style={[styles.hint, { color: color.inkSoft }]}>
              Se comparten solo estas cuentas y el versículo. Tus notas y lo de Sentir se quedan en tu cuenta.
            </Text>
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  pressed: { opacity: tokens.opacity.pressed },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  intro: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  // Tarjeta y renglón de Mi espacio.
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  row: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowDivider: { borderTopWidth: 1 },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  count: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  // Tarjeta de versículo de Guardados.
  verseCard: { padding: tokens.space.xl },
  kind: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  verse: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
    marginTop: tokens.space.md,
  },
  missing: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginTop: tokens.space.md,
  },
  footer: { borderTopWidth: 1, marginTop: tokens.space.lg, paddingTop: tokens.space.md },
  meta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  shareBlock: { gap: tokens.space.sm },
  hint: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    textAlign: "center",
  },
  // Vacío: el mismo de Guardados.
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
  emptyButton: { marginTop: tokens.space.md },
});
