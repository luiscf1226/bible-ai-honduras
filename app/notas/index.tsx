import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { Icon } from "../../src/components/Icon";
import { ListCard, ListRow } from "../../src/components/ListRow";
import { PersonalLockGate } from "../../src/components/PersonalLockGate";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { SearchField } from "../../src/components/SearchField";
import { filterSermonNotes, sermonByline, sermonDateLabel, sermonDisplayTitle, sermonPassageLabel } from "../../src/features/sermonNotes/sermonNotes";
import { useSermonNotes } from "../../src/features/sermonNotes/useSermonNotes";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/**
 * Notas de prédica (#232, Parte 2; design/oleada-ux.md §Notas de prédica).
 * Lista de la más reciente a la más vieja, con búsqueda por título,
 * predicador o pasaje. Cada renglón es el `ListRow` de Mi espacio: título,
 * la fecha y quién predicó, y los pasajes en serif.
 *
 * Privadas: respetan "Proteger lo personal" (#171) igual que el diario de
 * oración. Sin IA. Se ven y se escriben sin conexión.
 */
function NotasScreen() {
  const { color } = useTheme();
  const { loading, notes } = useSermonNotes();
  const [query, setQuery] = useState("");
  const visible = filterSermonNotes(notes ?? [], query);
  const hasNotes = (notes ?? []).length > 0;

  const openNew = () => router.push({ pathname: "/notas/[noteId]", params: { noteId: "nueva" } });

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader title="Notas de prédica" />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>
        Lo que anotás en el culto, con sus pasajes a un toque. Solo vos lo ves.
      </Text>

      <AppButton icon="plus" onPress={openNew} testID="notas-nueva">
        Nueva nota
      </AppButton>

      {hasNotes ? (
        <SearchField
          accessibilityLabel="Buscar en tus notas"
          compact
          onChangeText={setQuery}
          placeholder="Buscá por título, predicador o pasaje"
          testID="notas-buscar"
          value={query}
        />
      ) : null}

      {loading ? (
        <Text style={[styles.empty, { color: color.inkSoft }]}>Cargando tus notas…</Text>
      ) : !hasNotes ? (
        <View style={[styles.emptyCard, { backgroundColor: color.surfaceSunk }]} testID="notas-vacio">
          <Icon color={color.accent} name="sermon" size="lg" />
          <Text style={[styles.emptyTitle, { color: color.ink }]}>Tu cuaderno de prédicas</Text>
          <Text style={[styles.empty, { color: color.inkMuted }]}>
            El domingo, tocá «Nueva nota»: la fecha, quién predicó, los pasajes y lo que te llevás. Funciona sin señal.
          </Text>
        </View>
      ) : visible.length === 0 ? (
        <Text style={[styles.empty, { color: color.inkSoft }]} testID="notas-sin-resultados">
          Ninguna nota tiene «{query.trim()}».
        </Text>
      ) : (
        <ListCard testID="notas-lista">
          {visible.map((note) => {
            const byline = sermonByline(note);
            const meta = [sermonDateLabel(note.date), byline].filter(Boolean).join(" · ");
            return (
              <ListRow
                hint={note.pending ? `${meta} · Se sube cuando haya señal` : meta}
                key={note.clientId}
                latest={note.title.trim() && note.passages.length > 0 ? note.passages.map(sermonPassageLabel).join(" · ") : undefined}
                onPress={() => router.push({ pathname: "/notas/[noteId]", params: { noteId: note.clientId } })}
                testID={`notas-item-${note.clientId}`}
                title={sermonDisplayTitle(note)}
              />
            );
          })}
        </ListCard>
      )}
    </AppScreen>
  );
}

/** "Proteger lo personal" (#171): con el candado puesto, la lista pide desbloqueo. */
export default function NotasRoute() {
  return (
    <PersonalLockGate>
      <NotasScreen />
    </PersonalLockGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg },
  subtitle: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
    marginTop: -tokens.space.sm,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: tokens.radius.xl,
    gap: tokens.space.sm,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.space.xxl,
  },
  emptyTitle: { fontFamily: tokens.font.serif, fontSize: tokens.type.subtitle.size, lineHeight: tokens.type.subtitle.lineHeight },
  empty: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    textAlign: "center",
  },
});
