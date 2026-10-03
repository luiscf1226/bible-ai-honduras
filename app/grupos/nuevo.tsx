import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { GROUP_KINDS, groupDisplayName, joinStatusCopy, type GroupKind } from "../../convex/readingGroupCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { FilterPills } from "../../src/components/FilterPills";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { groupStyles as styles } from "../../src/features/groups/groupStyles";
import { useTheme } from "../../src/theme/ThemeProvider";

/**
 * Crear un grupo (#185). El nombre **no se escribe**: se elige el tipo de una
 * lista fija y se deriva del plan. Así no hay contenido de usuarios que
 * moderar (docs/spikes/moderacion-contenido-usuarios.md).
 */
export default function NuevoGrupoScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ planId?: string | string[] }>();
  const requestedPlanId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const plans = useQuery(api.readingGroups.planChoices, {});
  const create = useMutation(api.readingGroups.create);
  const [kind, setKind] = useState<GroupKind>("familia");
  const [planId, setPlanId] = useState<string | null>(requestedPlanId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = plans?.find((candidate) => candidate.id === planId) ?? null;

  const submit = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await create({ planId: plan.id, kind });
      if (result.status === "ok") {
        router.replace({ pathname: "/grupos/[groupId]", params: { groupId: result.groupId } });
      } else {
        setError(joinStatusCopy(result.status));
      }
    } catch {
      setError("No pudimos crear el grupo. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" title="Nuevo grupo" />

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.accent }]}>¿CON QUIÉN VAS A LEER?</Text>
        <FilterPills
          onSelect={setKind}
          options={GROUP_KINDS.map((entry) => ({ id: entry.id, label: entry.label }))}
          selected={kind}
          testID="grupo-nuevo-tipo"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.accent }]}>ELEGÍ EL PLAN</Text>
        {plans === undefined ? (
          <Text style={[styles.body, { color: color.inkSoft }]}>Cargando los planes…</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="grupo-nuevo-planes">
            {plans.map((candidate, index) => {
              const selected = candidate.id === planId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={candidate.id}
                  onPress={() => setPlanId(candidate.id)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.rowDivider,
                    index > 0 && { borderTopColor: color.border },
                    selected && { backgroundColor: color.surfaceSunk },
                    pressed && styles.pressed,
                  ]}
                  testID={`grupo-nuevo-plan-${candidate.id}`}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: color.ink }]}>{candidate.name}</Text>
                    <Text style={[styles.caption, { color: color.inkSoft }]}>{candidate.totalDays} días</Text>
                  </View>
                  <Text style={[styles.rowAction, { color: selected ? color.accent : color.inkFaint }]}>
                    {selected ? "✓" : "Elegir"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.caption, { color: color.inkSoft }]}>SE VA A LLAMAR</Text>
        <Text style={[styles.subtitle, { color: plan ? color.ink : color.inkFaint }]} testID="grupo-nuevo-nombre">
          {plan ? groupDisplayName(kind, plan.name) : "Elegí un plan"}
        </Text>
        <Text style={[styles.caption, { color: color.inkSoft }]}>
          Si no venías leyendo este plan, lo empezás hoy. Si ya lo venías leyendo, tu avance se queda como está.
        </Text>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.bodySm, { color: color.danger }]}>
          {error}
        </Text>
      ) : null}
      <AppButton disabled={!plan || busy} onPress={() => void submit()} testID="grupo-nuevo-crear">
        {busy ? "Creando…" : "Crear el grupo"}
      </AppButton>
    </AppScreen>
  );
}
