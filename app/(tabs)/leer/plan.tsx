import { useConvex, useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppButton } from "../../../src/components/AppButton";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { overlayPlanProgress } from "../../../src/features/offline/mutationQueue";
import { PLAN_UNAVAILABLE_OFFLINE } from "../../../src/features/offline/offlineCopy";
import { useOfflineSync } from "../../../src/features/offline/OfflineSyncProvider";
import { usePersistedQuery } from "../../../src/features/offline/usePersistedQuery";
import { isAnnualPlan, planOverline } from "../../../src/features/reading/annualPlans";
import { formatReadingsLabel, readingTarget, type PlanReading } from "../../../src/features/reading/planReadingsLabel";
import { openPassage } from "../../../src/lib/openPassage";
import { refreshDailyRemindersIfActive } from "../../../src/lib/reminderSchedule";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Pantalla de un plan de lectura: el anual (#114) sin parámetros, o un
 * recorrido corto (#115) con `?planId=`. Es el mismo motor, así que es la misma
 * pantalla. Leer es gratis: no consulta cuotas ni muestra paywall (mismo
 * criterio que #112/#113).
 *
 * No hay prototipo de Claude Design para esta pantalla (regla dura #1 del
 * issue) — se construyó reusando los tokens y las convenciones visuales de
 * las pantallas hermanas del módulo de Lectura (`leer/index.tsx`,
 * `leer/[book]/[chapter].tsx`), sin ningún hex, tamaño o radio nuevo.
 */

function openReading(reading: PlanReading) {
  // Un pasaje de recorrido abre el lector en su primer versículo.
  openPassage(readingTarget(reading));
}

export default function PlanScreen() {
  const { color } = useTheme();
  const convex = useConvex();
  const params = useLocalSearchParams<{ planId?: string | string[] }>();
  const requestedPlanId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const planArgs = requestedPlanId ? { planId: requestedPlanId } : {};
  const isJourney = !isAnnualPlan(requestedPlanId);
  // El canónico no muestra su nombre en "hoy" (#114); el plan para empezar sí,
  // para que se distinga cuál de los dos anuales está abierto.
  const showsPlanName = isJourney || (requestedPlanId !== undefined && requestedPlanId !== "canonico");
  // Sin conexión (#160): el plan sale de lo último que se vio con señal, y
  // marcar un día pasa por la cola (#182): se tacha al instante y se manda
  // cuando vuelve la red.
  const planKey = requestedPlanId ?? "canonico";
  const catalog = usePersistedQuery(api.readingPlans.catalog, planArgs, `planCatalog:${planKey}`);
  const { online, pending, run } = useOfflineSync();
  const progress = overlayPlanProgress(
    usePersistedQuery(api.readingPlans.myProgress, planArgs, `planProgress:${planKey}`),
    pending,
  );
  const startPlan = useMutation(api.readingPlans.start);
  const [isStarting, setIsStarting] = useState(false);

  const begin = async () => {
    if (!catalog || isStarting) return;
    setIsStarting(true);
    try {
      await startPlan({ planId: catalog.id });
      // El aviso diario menciona la lectura del plan abierto más recientemente (#153).
      void refreshDailyRemindersIfActive(convex);
    } finally {
      setIsStarting(false);
    }
  };

  const markDay = (day: number) => {
    if (!catalog) return;
    run({ kind: "planDay", planId: catalog.id, day });
    // El aviso diario menciona la lectura del plan (#153): se reprograma.
    void refreshDailyRemindersIfActive(convex);
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title={isJourney ? "Recorrido" : "Plan de lectura"} />

      {catalog === null ? (
        <Text style={[styles.status, { color: color.inkSoft }]} testID="plan-unknown">
          Este recorrido ya no está disponible.
        </Text>
      ) : progress === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]} testID={online ? undefined : "plan-unavailable-offline"}>
          {online ? "Preparando tu plan…" : PLAN_UNAVAILABLE_OFFLINE}
        </Text>
      ) : progress === null ? (
        <View style={[styles.introCard, { backgroundColor: color.surface, borderColor: color.border }]} testID="plan-intro">
          <Text style={[styles.overline, { color: color.accent }]}>{planOverline(requestedPlanId)}</Text>
          <Text style={[styles.introTitle, { color: color.ink }]}>{catalog?.name ?? "Plan de lectura"}</Text>
          <Text style={[styles.introDescription, { color: color.inkMuted }]}>
            {catalog?.description ?? ""}
          </Text>
          {catalog ? (
            <Text style={[styles.introMeta, { color: color.inkSoft }]}>{catalog.totalDays} días · una lectura diaria</Text>
          ) : null}
          <AppButton disabled={!catalog || isStarting} onPress={() => void begin()} style={styles.introButton} testID="plan-start">
            {isStarting ? "Empezando…" : isJourney ? "Empezar el recorrido" : "Empezar el plan"}
          </AppButton>
        </View>
      ) : (
        <>
          <View style={[styles.todayCard, { backgroundColor: color.surface, borderColor: color.border }]} testID="plan-today">
            {showsPlanName ? <Text style={[styles.introTitle, { color: color.ink }]}>{progress.plan.name}</Text> : null}
            <Text style={[styles.overline, { color: color.accent }]}>
              HOY · DÍA {progress.currentDay} DE {progress.plan.totalDays}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => progress.todayReadings[0] && openReading(progress.todayReadings[0])}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={[styles.todayReading, { color: color.ink }]}>{formatReadingsLabel(progress.todayReadings)}</Text>
            </Pressable>
            {progress.todayCompleted ? (
              <Text style={[styles.doneLabel, { color: color.sage }]} testID="plan-today-done">
                Leída hoy
              </Text>
            ) : (
              <AppButton
                onPress={() => markDay(progress.currentDay)}
                style={styles.markButton}
                testID="plan-mark-today"
                variant="secondary"
              >
                Marcar como leída
              </AppButton>
            )}
          </View>

          <View style={[styles.statsCard, { backgroundColor: color.surfaceAlt, borderColor: color.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: color.ink }]}>{progress.completedCount}</Text>
                <Text style={[styles.statLabel, { color: color.inkSoft }]}>de {progress.plan.totalDays} días leídos</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: color.ink }]}>{progress.currentStreak}</Text>
                <Text style={[styles.statLabel, { color: color.inkSoft }]}>racha actual</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: color.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: color.accent, width: `${Math.round((progress.completedCount / progress.plan.totalDays) * 100)}%` },
                ]}
              />
            </View>
          </View>

          {progress.completedCount === progress.plan.totalDays ? (
            <View style={styles.catchUpSection} testID="plan-finished">
              <Text style={[styles.sectionTitle, { color: color.ink }]}>
                {isJourney ? "Terminaste este recorrido" : "Terminaste el plan"}
              </Text>
              <AppButton disabled={isStarting} onPress={() => void begin()} testID="plan-restart" variant="secondary">
                {isStarting ? "Empezando…" : "Empezar de nuevo"}
              </AppButton>
            </View>
          ) : null}

          {progress.pendingDays.length > 0 ? (
            <View style={styles.catchUpSection} testID="plan-catch-up">
              <Text style={[styles.sectionTitle, { color: color.ink }]}>Seguí desde donde estés</Text>
              <Text style={[styles.sectionDescription, { color: color.inkMuted }]}>
                No hay apuro ni orden obligatorio. Continuá con las lecturas pendientes cuando puedas.
              </Text>
              {progress.pendingDays.map((entry) => (
                <View key={entry.day} style={[styles.pendingRow, { borderColor: color.border }]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => entry.readings[0] && openReading(entry.readings[0])}
                    style={({ pressed }) => [styles.pendingReading, pressed && styles.pressed]}
                  >
                    <Text style={[styles.pendingDayLabel, { color: color.inkSoft }]}>DÍA {entry.day}</Text>
                    <Text style={[styles.pendingReadingLabel, { color: color.ink }]}>{formatReadingsLabel(entry.readings)}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => markDay(entry.day)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text style={[styles.pendingMark, { color: color.accent }]}>Marcar leída</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

      {/* #185: el mismo plan, leído en un grupo cerrado (familia, célula). */}
      {catalog ? (
        <AppButton
          onPress={() => router.push({ pathname: "/grupos/nuevo", params: { planId: catalog.id } })}
          testID="plan-leer-en-grupo"
          variant="quiet"
        >
          Leer este plan en grupo
        </AppButton>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size },
  pressed: { opacity: tokens.opacity.pressed },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  introCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  introTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.title.size, lineHeight: tokens.type.title.lineHeight },
  introDescription: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.body.size, lineHeight: tokens.type.body.lineHeight },
  introMeta: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  introButton: { marginTop: tokens.space.md },
  todayCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  todayReading: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  doneLabel: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  markButton: { marginTop: tokens.space.xs },
  statsCard: {
    borderRadius: tokens.radius.xl,
    borderWidth: 1,
    gap: tokens.space.md,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  stat: { gap: tokens.space.xxs },
  statValue: { fontFamily: tokens.font.serif, fontSize: tokens.type.display.size, lineHeight: tokens.type.display.lineHeight },
  statLabel: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  // Grosor de la barra de progreso: reusa `tokens.size.dot` (ya usado para los
  // puntos de paginación del onboarding) en vez de inventar un número nuevo.
  progressTrack: { borderRadius: tokens.radius.pill, height: tokens.size.dot, overflow: "hidden", width: "100%" },
  progressFill: { borderRadius: tokens.radius.pill, height: "100%" },
  catchUpSection: { gap: tokens.space.sm },
  sectionTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  sectionDescription: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  pendingRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: tokens.space.sm,
  },
  pendingReading: { flex: 1, gap: tokens.space.xxs },
  pendingDayLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  pendingReadingLabel: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size },
  pendingMark: { fontFamily: tokens.font.sansMedium, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
