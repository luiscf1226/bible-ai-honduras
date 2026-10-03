import { useMutation, useQuery } from "convex/react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../../convex/_generated/api";
import { useTheme } from "../../../theme/ThemeProvider";
import { tokens } from "../../../theme/tokens";
import { HomeCard, openFromHome } from "./HomeCard";
import { savedMemoryMeta, savedMemoryNote, savedMemoryReference, savedMemoryRoute } from "./savedMemoryLines";

/**
 * "Hace un año guardaste…" (#172): una vez por semana, un versículo que la
 * persona guardó hace más de 30 días, con su nota (#167) si la tiene.
 *
 * El guardado lo elige el servidor (`api.savedMemory.thisWeek`), determinístico
 * por persona y semana de Honduras; si no toca (menos de 3 guardados, ninguno
 * viejo, cerrada esta semana o apagada en Ajustes) devuelve null y la tarjeta
 * no existe.
 *
 * Diseño (oleada UX, sin pantalla en el prototipo): la `HomeCard` base con el
 * ícono de guardado y el titular del servidor como título; adentro, el mismo
 * cuerpo que la tarjeta de Guardados (versículo en serif `versePicker`, nota
 * en un bloque `surfaceSunk`) y una fila de abajo con la referencia y
 * "Ahora no", como el pie de `SavedVerseCard`. Cero tokens nuevos.
 */
export function SavedMemoryCard() {
  const { color } = useTheme();
  const memory = useQuery(api.savedMemory.thisWeek, {});
  const dismiss = useMutation(api.savedMemory.dismiss);

  if (!memory) return null;

  const note = savedMemoryNote(memory.note);

  // Abrirla cuenta como verla: no vuelve a aparecer en la semana.
  const open = () => {
    openFromHome(savedMemoryRoute(memory));
    void dismiss({}).catch(() => undefined);
  };

  return (
    <HomeCard
      accessibilityHint="Abre el versículo en el lector."
      icon="bookmark"
      onPress={open}
      testID="home-card-saved-memory"
      title={memory.headline}
    >
      <Text numberOfLines={4} style={[styles.verse, { color: color.ink }]}>
        {memory.text !== null ? `“${memory.text}”` : savedMemoryReference(memory)}
      </Text>

      {note ? (
        <View style={[styles.note, { backgroundColor: color.surfaceSunk }]} testID="home-saved-memory-note">
          <Text numberOfLines={3} style={[styles.noteText, { color: color.inkMuted }]}>
            {note}
          </Text>
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: color.border }]}>
        <Text numberOfLines={2} style={[styles.meta, { color: color.inkSoft }]}>
          {savedMemoryMeta(memory)}
        </Text>
        <Pressable
          accessibilityHint="Esconde este recuerdo hasta la semana que viene."
          accessibilityRole="button"
          hitSlop={tokens.space.sm}
          onPress={() => void dismiss({}).catch(() => undefined)}
          testID="home-saved-memory-dismiss"
        >
          <Text style={[styles.action, { color: color.inkSoft }]}>Ahora no</Text>
        </Pressable>
      </View>
    </HomeCard>
  );
}

const styles = StyleSheet.create({
  verse: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  note: { borderRadius: tokens.radius.md, padding: tokens.space.md },
  noteText: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    justifyContent: "space-between",
    paddingTop: tokens.space.md,
  },
  meta: {
    flexShrink: 1,
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
  },
  action: { fontFamily: tokens.font.sans, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
});
