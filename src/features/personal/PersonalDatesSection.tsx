import { useConvex, useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { localDateKey, type FaithDateKind } from "../../../convex/personalDates";
import { AppButton } from "../../components/AppButton";
import { FilterPills } from "../../components/FilterPills";
import { refreshDailyRemindersIfActive } from "../../lib/reminderSchedule";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import {
  birthdayFromDraft,
  describeBirthday,
  describeFaithDate,
  draftFromBirthday,
  draftFromFaithDate,
  FAITH_KIND_LABELS,
  faithDateFromDraft,
  MONTHS,
  type DateDraft,
} from "./personalDates";

type Field = "birthday" | "faith";

const MONTH_OPTIONS = MONTHS.map((name, index) => ({ id: String(index + 1), label: name.charAt(0).toUpperCase() + name.slice(1, 3) }));
// Tres filas parejas de cuatro meses (una sola fila envuelta deja la última desigual).
const MONTH_ROWS = [MONTH_OPTIONS.slice(0, 4), MONTH_OPTIONS.slice(4, 8), MONTH_OPTIONS.slice(8, 12)];
const KIND_OPTIONS = (Object.keys(FAITH_KIND_LABELS) as FaithDateKind[]).map((id) => ({ id, label: FAITH_KIND_LABELS[id] }));

type Props = {
  user: { birthday?: string; faithDate?: string; faithDateKind?: FaithDateKind } | null | undefined;
};

/**
 * Tus fechas (#204) en Mi espacio: cumpleaños (día y mes) y bautismo o
 * conversión (con año). Las dos son opcionales. Cada renglón se abre en el
 * mismo lugar para editar, con la misma tarjeta y renglón de Mi espacio; el
 * mes se elige con `FilterPills` y el día y el año se escriben.
 */
export function PersonalDatesSection({ user }: Props) {
  const { color } = useTheme();
  const convex = useConvex();
  const save = useMutation(api.users.setPersonalDates);
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState<DateDraft>({ day: "", month: null, year: "" });
  const [kind, setKind] = useState<FaithDateKind>("bautismo");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loading = user === undefined;

  const birthday = describeBirthday(user?.birthday);
  const faith = describeFaithDate(user?.faithDate);
  const faithKind = user?.faithDateKind ?? "bautismo";

  const open = (field: Field) => {
    setError(null);
    if (editing === field) {
      setEditing(null);
      return;
    }
    setEditing(field);
    setDraft(field === "birthday" ? draftFromBirthday(user?.birthday) : draftFromFaithDate(user?.faithDate));
    setKind(faithKind);
  };

  const persist = async (args: Parameters<typeof save>[0]) => {
    setBusy(true);
    try {
      await save(args);
      setEditing(null);
      setError(null);
      // El aviso de ese día saluda: se reprograma si ya estaba activo.
      void refreshDailyRemindersIfActive(convex);
    } catch {
      setError("No pudimos guardar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const result = editing === "birthday" ? birthdayFromDraft(draft) : faithDateFromDraft(draft, localDateKey(new Date()));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void persist(editing === "birthday" ? { birthday: result.value } : { faithDate: result.value, faithDateKind: kind });
  };

  const remove = () => {
    void persist(editing === "birthday" ? { birthday: null } : { faithDate: null, faithDateKind: null });
  };

  const rows: { field: Field; title: string; value: string | null; hint: string }[] = [
    { field: "birthday", title: "Cumpleaños", value: birthday, hint: "Solo el día y el mes" },
    {
      field: "faith",
      title: "Bautismo o conversión",
      value: faith ? `${FAITH_KIND_LABELS[faithKind]} · ${faith}` : null,
      hint: "Opcional",
    },
  ];

  return (
    <View testID="mi-espacio-fechas">
      <Text style={[styles.sectionLabel, { color: color.inkSoft }]}>Tus fechas</Text>
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]}>
        <Text style={[styles.intro, { color: color.inkMuted }]}>
          Ese día el inicio te saluda con un versículo. Solo vos las ves.
        </Text>
        {rows.map((row) => {
          const isOpen = editing === row.field;
          const hasValue = row.value !== null;
          return (
            <View key={row.field} style={[styles.rowDivider, { borderTopColor: color.border }]}>
              <Pressable
                accessibilityHint={isOpen ? "Cierra sin guardar." : `Abre para ${hasValue ? "cambiar" : "agregar"} la fecha.`}
                accessibilityLabel={hasValue ? `${row.title}, ${row.value}` : row.title}
                accessibilityRole="button"
                disabled={loading || busy}
                onPress={() => open(row.field)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                testID={`mi-espacio-fechas-${row.field}`}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: color.ink }]}>{row.title}</Text>
                  <Text style={[hasValue ? styles.value : styles.rowHint, { color: hasValue ? color.inkMuted : color.inkSoft }]}>
                    {loading ? "…" : (row.value ?? row.hint)}
                  </Text>
                </View>
                <Text style={[styles.action, { color: hasValue ? color.accentDeep : color.inkSoft }]}>
                  {isOpen ? "Cerrar" : hasValue ? "Cambiar ›" : "Agregar ›"}
                </Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.editor} testID={`mi-espacio-fechas-${row.field}-editor`}>
                  {row.field === "faith" ? (
                    <FilterPills onSelect={setKind} options={KIND_OPTIONS} selected={kind} testID="mi-espacio-fechas-tipo" />
                  ) : null}
                  <View style={styles.inputs}>
                    <TextInput
                      accessibilityLabel="Día"
                      keyboardType="number-pad"
                      maxLength={2}
                      onChangeText={(day) => setDraft((current) => ({ ...current, day }))}
                      placeholder="Día"
                      placeholderTextColor={color.inkFaint}
                      style={[styles.input, { backgroundColor: color.surfaceSunk, borderColor: color.borderStrong, color: color.ink }]}
                      testID="mi-espacio-fechas-dia"
                      value={draft.day}
                    />
                    {row.field === "faith" ? (
                      <TextInput
                        accessibilityLabel="Año"
                        keyboardType="number-pad"
                        maxLength={4}
                        onChangeText={(year) => setDraft((current) => ({ ...current, year }))}
                        placeholder="Año"
                        placeholderTextColor={color.inkFaint}
                        style={[styles.input, { backgroundColor: color.surfaceSunk, borderColor: color.borderStrong, color: color.ink }]}
                        testID="mi-espacio-fechas-ano"
                        value={draft.year}
                      />
                    ) : null}
                  </View>
                  <View accessibilityLabel="Mes" style={styles.months}>
                    {MONTH_ROWS.map((options, index) => (
                      <FilterPills
                        key={index}
                        onSelect={(id) => setDraft((current) => ({ ...current, month: Number(id) }))}
                        options={options}
                        selected={draft.month === null ? "" : String(draft.month)}
                        testID="mi-espacio-fechas-mes"
                      />
                    ))}
                  </View>
                  {error ? (
                    <Text accessibilityRole="alert" style={[styles.rowHint, { color: color.danger }]} testID="mi-espacio-fechas-error">
                      {error}
                    </Text>
                  ) : null}
                  <AppButton disabled={busy} onPress={submit} testID="mi-espacio-fechas-guardar">
                    Guardar
                  </AppButton>
                  {hasValue ? (
                    <AppButton disabled={busy} onPress={remove} testID="mi-espacio-fechas-quitar" variant="quiet">
                      Quitar esta fecha
                    </AppButton>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mismo rótulo de sección que Ajustes.
  sectionLabel: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    marginBottom: tokens.space.md,
    marginTop: tokens.space.xxl + tokens.space.xs,
    textTransform: "uppercase",
  },
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, overflow: "hidden" },
  intro: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  pressed: { opacity: tokens.opacity.pressed },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  rowDivider: { borderTopWidth: 1 },
  rowText: { flex: 1, paddingRight: tokens.space.md },
  rowLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  // La fecha guardada va en serif, como lo último de cada sección de Mi espacio.
  value: { fontFamily: tokens.font.serif, fontSize: tokens.type.body.size, lineHeight: tokens.type.bodySm.lineHeight, marginTop: tokens.space.xs },
  rowHint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, marginTop: tokens.space.xs },
  action: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size },
  editor: { gap: tokens.space.md, paddingBottom: tokens.cardPadding.vertical, paddingHorizontal: tokens.cardPadding.horizontal },
  inputs: { flexDirection: "row", gap: tokens.space.sm },
  months: { gap: tokens.space.sm },
  // Mismo campo que el código de invitación de Ajustes.
  input: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    // Base 0: en web el TextInput trae ancho propio y desbordaba la tarjeta.
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
    fontFamily: tokens.font.sans,
    fontSize: tokens.type.body.size,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.lg,
  },
});
