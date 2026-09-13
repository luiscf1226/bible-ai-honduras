import { useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { openReadingPlan } from "../../../src/lib/openPassage";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Catálogo de recorridos cortos (#115): planes de 7 a 30 días por tema,
 * historia o sentimiento, que se siguen a la par del plan anual. Gratis, sin
 * cuotas ni paywall (mismo criterio que el resto de Lectura).
 *
 * El catálogo de recorridos no existe en el prototipo de Claude Design: esta
 * pantalla reusa las tarjetas de `leer/index.tsx` y `leer/plan.tsx` (mismos
 * tokens de color, tipografía, radio y padding), sin ningún valor nuevo.
 */
export default function RecorridosScreen() {
  const { color } = useTheme();
  const journeys = useQuery(api.readingPlans.journeys, {});
  const myPlans = useQuery(api.readingPlans.myPlans, {});

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Recorridos" titleSize="pick" />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>
        Lecturas cortas para seguir a la par de tu plan anual.
      </Text>

      {journeys === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Cargando recorridos…</Text>
      ) : (
        <View style={styles.list} testID="journeys-list">
          {journeys.map((journey) => {
            const active = myPlans?.find((plan) => plan.plan.id === journey.id);
            const status = active
              ? active.completedCount === journey.totalDays
                ? "TERMINADO"
                : `EN CURSO · DÍA ${active.currentDay} DE ${journey.totalDays}`
              : `${journey.totalDays} DÍAS`;

            return (
              <Pressable
                accessibilityHint="Abre este recorrido."
                accessibilityRole="button"
                key={journey.id}
                onPress={() => openReadingPlan(journey.id)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: color.surfaceAlt, borderColor: color.border },
                  pressed && styles.pressed,
                ]}
                testID={`journey-${journey.id}`}
              >
                <Text style={[styles.overline, { color: color.accent }]}>{status}</Text>
                <Text style={[styles.name, { color: color.ink }]}>{journey.name}</Text>
                <Text style={[styles.description, { color: color.inkMuted }]}>{journey.description}</Text>
              </Pressable>
            );
          })}
        </View>
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
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  list: { gap: tokens.space.md },
  card: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.xs,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  name: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  description: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
