import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppScreen } from "../../../src/components/AppScreen";
import { ScreenHeader, goBackOrHome } from "../../../src/components/ScreenHeader";
import { SavedVerseCard } from "../../../src/features/reading/SavedVerseCard";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { tokens } from "../../../src/theme/tokens";

/**
 * Todos los versículos guardados (#166), del más reciente al más viejo. Es la
 * pantalla "Guardados" del prototype con solo la pestaña de versículos: los
 * devocionales y respuestas guardados todavía no existen en el backend.
 */
export default function GuardadosScreen() {
  const { color } = useTheme();
  const currentUser = useQuery(api.users.current);
  const bookmarks = useQuery(api.reading.bookmarks, {});

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader accessibilityLabel="Volver" onBack={goBackOrHome} title="Guardados" titleSize="pick" />

      {bookmarks === undefined ? (
        <Text style={[styles.status, { color: color.inkSoft }]}>Abriendo tus guardados…</Text>
      ) : bookmarks.total === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: color.inkMuted }]}>Todavía no guardas nada aquí</Text>
          <Text style={[styles.emptyBody, { color: color.inkFaint }]}>
            Tocá un versículo mientras leés y elegí “Guardar” para volver a leerlo después.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {bookmarks.items.map((bookmark) => (
            <SavedVerseCard
              item={bookmark}
              key={`${bookmark.book}-${bookmark.chapter}-${bookmark.verse}`}
              referralCode={currentUser?.referralCode}
            />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.xl, paddingBottom: tokens.space.xxl },
  list: { gap: tokens.space.md },
  status: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.bodySm.size, lineHeight: tokens.type.bodySm.lineHeight },
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
});
