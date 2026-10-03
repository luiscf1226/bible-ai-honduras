import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../convex/_generated/api";
import { AppButton } from "../src/components/AppButton";
import { AppScreen } from "../src/components/AppScreen";
import { FilterPills } from "../src/components/FilterPills";
import { ScreenHeader, goBackOrHome } from "../src/components/ScreenHeader";
import { PrayerCard } from "../src/features/personal/PrayerCard";
import {
  emptyPrayersCopy,
  PRAYER_MAX_LENGTH,
  prayerFilterOptions,
  splitPrayers,
  type PrayerFilter,
} from "../src/features/personal/prayerJournal";
import { useTheme } from "../src/theme/ThemeProvider";
import { tokens } from "../src/theme/tokens";

/**
 * Diario de oración (#159): peticiones privadas, abiertas y respondidas. Se
 * llega desde Mi espacio y desde "Guardar como petición" al cerrar un
 * devocional de Sentir.
 *
 * No está en el prototype: se arma con piezas que ya existen (ScreenHeader,
 * FilterPills de Guardados, el campo de la nota del lector y la tarjeta de
 * Guardados). Cero tokens nuevos. Falta ratificarla en Claude Design.
 *
 * Gratis y sin IA: nada de esta pantalla viaja a un prompt.
 */
export default function OracionScreen() {
  const { color } = useTheme();
  const prayers = useQuery(api.prayers.list, {});
  const create = useMutation(api.prayers.create);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PrayerFilter>("abiertas");

  const { open, answered } = splitPrayers(prayers ?? []);
  const visible = filter === "abiertas" ? open : answered;

  const save = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await create({ text: draft });
      setDraft("");
      setError(null);
      setFilter("abiertas");
    } catch {
      setError("No pudimos guardar tu petición. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Diario de oración" titleSize="pick" />
      <Text style={[styles.privacy, { color: color.inkSoft }]}>
        Solo vos ves esto. No se comparte, no se publica y no se envía a la IA.
      </Text>

      <View style={styles.composer}>
        <Text style={[styles.label, { color: color.accent }]}>NUEVA PETICIÓN</Text>
        <TextInput
          accessibilityLabel="Escribí tu petición de oración"
          maxLength={PRAYER_MAX_LENGTH}
          multiline
          onChangeText={setDraft}
          placeholder="Por ejemplo: “Por la salud de mi abuela”."
          placeholderTextColor={color.inkFaint}
          style={[styles.input, { backgroundColor: color.surface, borderColor: color.border, color: color.ink }]}
          testID="prayer-new-input"
          textAlignVertical="top"
          value={draft}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.status, { color: color.accentDeep }]}>
            {error}
          </Text>
        ) : null}
        <AppButton disabled={!draft.trim() || saving} onPress={() => void save()} testID="prayer-new-save">
          Guardar petición
        </AppButton>
      </View>

      {prayers === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo tu diario…</Text>
      ) : (
        <>
          <FilterPills onSelect={setFilter} options={prayerFilterOptions(prayers)} selected={filter} testID="prayer-filter" />
          {visible.length === 0 ? (
            <Text style={[styles.status, { color: color.inkSoft }]} testID="prayer-empty">
              {emptyPrayersCopy(filter)}
            </Text>
          ) : (
            <View style={styles.list}>
              {visible.map((item) => (
                <PrayerCard item={item} key={item.id} />
              ))}
            </View>
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  privacy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: -tokens.space.md,
  },
  composer: { gap: tokens.space.sm },
  label: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  input: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    lineHeight: tokens.type.body.lineHeight,
    maxHeight: tokens.size.logoLarge,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  list: { gap: tokens.space.md },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
});
