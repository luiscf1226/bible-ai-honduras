import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AppScreen } from "../../src/components/AppScreen";
import { EntryCard, EntryCardRow } from "../../src/components/EntryCard";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { BEGINNER_PLAN_ID } from "../../src/features/reading/annualPlans";
import { openReadingPlan, openTimeline } from "../../src/lib/openPassage";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/**
 * Planes y recorridos (#232, Fase 3): antes eran 5 tarjetas arriba del índice
 * de libros en `/leer`. Ahora Leer tiene una sola entrada y acá están todas,
 * con las mismas tarjetas (`EntryCard`) y los mismos textos.
 */
export default function PlanesScreen() {
  const { color } = useTheme();
  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader title="Planes y recorridos" />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>Para leer con un rumbo, solo o en grupo.</Text>

      <EntryCard
        accessibilityHint="Abre el plan de un año pensado para quien nunca leyó la Biblia completa."
        description="Cada día: Antiguo Testamento, Nuevo Testamento y Salmos o Proverbios."
        onPress={() => openReadingPlan(BEGINNER_PLAN_ID)}
        overline="Para empezar · 365 días"
        testID="leer-beginner-plan-entry"
        title="Toda la Biblia en un año, un poco de cada parte"
      />
      <EntryCardRow>
        <EntryCard half onPress={() => router.push("/leer/plan")} overline="Plan de lectura" testID="leer-plan-entry" title="De Génesis a Apocalipsis" />
        <EntryCard half onPress={() => router.push("/leer/recorridos")} overline="Recorridos" testID="leer-journeys-entry" title="Lecturas cortas por tema" />
      </EntryCardRow>
      {/* Línea del tiempo (#201). */}
      <EntryCard
        onPress={() => openTimeline()}
        overline="Línea del tiempo"
        testID="leer-timeline-entry"
        title="Dónde cae cada libro, de la creación a Apocalipsis"
      />
      <EntryCard onPress={() => router.push("/grupos")} overline="En grupo" testID="leer-groups-entry" title="Un plan con tu familia o tu célula" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
    marginTop: -tokens.space.sm,
  },
});
