import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { openPassage } from "../../lib/openPassage";
import { useTheme } from "../../theme/ThemeProvider";
import { tokens } from "../../theme/tokens";
import { removeSavedCopy, savedWhenLabel } from "./savedVerses";
import { shareVerse } from "./shareVerse";

export type SavedVerse = FunctionReturnType<typeof api.reading.bookmarks>["items"][number];

type SavedVerseCardProps = {
  item: SavedVerse;
  /** Sin código de referido no hay link para compartir: se oculta la acción. */
  referralCode?: string;
};

/**
 * Tarjeta de un versículo guardado (#166). Sale de la pantalla "Guardados" del
 * prototype: etiqueta, versículo en serif y una fila de abajo con la
 * referencia y "Compartir". "Quitar" y la nota (#167) se componen con piezas
 * que ya existen (la acción de texto de "Compartir" y el fondo `surfaceSunk`
 * de los chips elegidos): cero tokens nuevos.
 *
 * Tocar la tarjeta abre el lector con la hoja de acciones del versículo, que
 * es donde se agrega o edita la nota.
 *
 * Compartir manda solo el versículo: la nota es privada y nunca se comparte.
 */
export function SavedVerseCard({ item, referralCode }: SavedVerseCardProps) {
  const { color } = useTheme();
  const removeBookmark = useMutation(api.reading.removeBookmark);
  const reference = `${item.book} ${item.chapter}:${item.verse}`;
  const text = item.text;

  const confirmRemove = () => {
    const copy = removeSavedCopy(item.note !== null);
    Alert.alert(copy.title, copy.body, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => {
          void removeBookmark({ book: item.book, chapter: item.chapter, verse: item.verse }).catch(() => undefined);
        },
      },
    ]);
  };

  const share = () => {
    if (!referralCode || text === null) return;
    void shareVerse({ verse: { ...item, text }, referralCode });
  };

  return (
    <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.border }]} testID="saved-verse-card">
      {/* La zona que abre el lector no envuelve las acciones de abajo: un botón
          dentro de otro rompe en web y confunde a los lectores de pantalla. */}
      <Pressable
        accessibilityHint="Abre el versículo en el lector."
        accessibilityRole="button"
        onPress={() => openPassage(item)}
        style={({ pressed }) => pressed && styles.pressed}
        testID="saved-verse-open"
      >
        <Text style={[styles.kind, { color: color.accent }]}>VERSÍCULO</Text>
        {text !== null ? (
          <Text numberOfLines={3} style={[styles.text, { color: color.ink }]}>
            “{text}”
          </Text>
        ) : (
          <Text style={[styles.missing, { color: color.inkSoft }]}>
            Este versículo todavía no está en {item.version}. Tocá para abrir el capítulo.
          </Text>
        )}

        {item.note !== null ? (
          <View style={[styles.note, { backgroundColor: color.surfaceSunk }]} testID="saved-verse-note">
            <Text numberOfLines={3} style={[styles.noteText, { color: color.inkMuted }]}>
              {item.note}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <View style={[styles.footer, { borderTopColor: color.border }]}>
        <Text numberOfLines={1} style={[styles.meta, { color: color.inkSoft }]}>
          {reference} · {savedWhenLabel(item.createdAt)}
        </Text>
        <View style={styles.actions}>
          {referralCode && text !== null ? (
            <Pressable accessibilityRole="button" hitSlop={tokens.space.sm} onPress={share}>
              <Text style={[styles.action, { color: color.sage }]}>Compartir</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={`Quitar ${reference} de guardados`}
            accessibilityRole="button"
            hitSlop={tokens.space.sm}
            onPress={confirmRemove}
            testID="saved-verse-remove"
          >
            <Text style={[styles.action, { color: color.inkSoft }]}>Quitar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: tokens.radius.xl, borderWidth: 1, padding: tokens.space.xl },
  pressed: { opacity: tokens.opacity.pressed },
  kind: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    textTransform: "uppercase",
  },
  text: {
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
  note: { borderRadius: tokens.radius.md, marginTop: tokens.space.md, padding: tokens.space.md },
  noteText: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
  },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: tokens.space.md,
    justifyContent: "space-between",
    marginTop: tokens.space.lg,
    paddingTop: tokens.space.md,
  },
  meta: { flexShrink: 1, fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
  actions: { flexDirection: "row", gap: tokens.space.lg },
  action: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size },
});
