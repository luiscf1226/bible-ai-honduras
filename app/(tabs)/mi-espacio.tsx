import { useQuery } from "convex/react";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, StyleSheet, Text } from "react-native";

import { api } from "../../convex/_generated/api";
import { AppScreen } from "../../src/components/AppScreen";
import { Icon } from "../../src/components/Icon";
import { ListCard, ListRow, ListSectionLabel } from "../../src/components/ListRow";
import { PersonalLockGate } from "../../src/components/PersonalLockGate";
import { HeaderIconButton, ScreenHeader } from "../../src/components/ScreenHeader";
import { buildMySpaceSections, MY_SPACE_GROUPS, type MySpaceDestination } from "../../src/features/personal/mySpaceSections";
import { PersonalDatesSection } from "../../src/features/personal/PersonalDatesSection";
import { yearInWordEntry } from "../../src/features/personal/yearInWord";
import { sermonDisplayTitle } from "../../src/features/sermonNotes/sermonNotes";
import { useSermonNotes } from "../../src/features/sermonNotes/useSermonNotes";
import { PRIVACY_POLICY_URL } from "../../src/lib/legalLinks";
import { openPassage } from "../../src/lib/openPassage";
import { hondurasToday } from "../../src/lib/reminderDates";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

function go(destination: MySpaceDestination) {
  if (destination.kind === "passage") {
    openPassage(destination.passage);
    return;
  }
  router.push(destination.href);
}

/**
 * Pestaña Mi espacio (#169, #232): todo lo personal en un solo lugar, en tres
 * grupos (Tu Biblia, Tu vida de fe, Conversaciones), más Exportar y Tus
 * fechas. Memorizar, Tu año, Oración, Notas de prédica, Mis conversaciones y
 * Exportar quedan a un toque. Cada renglón es un `ListRow` y lleva a la
 * pantalla que ya existe.
 */
function MiEspacioScreen() {
  const { color } = useTheme();
  const separator = useQuery(api.reading.separator, {});
  const bookmarks = useQuery(api.reading.bookmarks, {});
  const highlights = useQuery(api.reading.highlights, {});
  const history = useQuery(api.history.list, {});
  const me = useQuery(api.users.current, {});
  const memorize = useQuery(api.memorize.list, {});
  const prayers = useQuery(api.prayers.list, {});
  const sermonNotes = useSermonNotes();
  const loading =
    separator === undefined ||
    bookmarks === undefined ||
    highlights === undefined ||
    history === undefined ||
    memorize === undefined ||
    prayers === undefined ||
    sermonNotes.loading;

  // "Tu año en la Palabra" (#183): el resumen completo es de diciembre a
  // enero; el resto del año el renglón igual está, para que no quede huérfano (#232).
  const yearEntry = yearInWordEntry(hondurasToday()) ?? {
    title: "Tu año en la Palabra",
    hint: "Lo que llevás leído este año. En diciembre se arma el resumen completo.",
  };

  const sections = buildMySpaceSections({
    separator: separator ?? null,
    bookmarks: bookmarks?.items ?? [],
    highlights: highlights ?? [],
    history: history ?? [],
    memorize: { total: memorize?.items.length ?? 0, dueCount: memorize?.dueCount ?? 0 },
    prayers: prayers ?? [],
    sermonNotes: (sermonNotes.notes ?? []).map((note) => ({ displayTitle: sermonDisplayTitle(note) })),
  });

  return (
    <AppScreen scroll contentStyle={styles.content} style={{ backgroundColor: color.surface }}>
      <ScreenHeader
        showBack={false}
        style={styles.header}
        title="Mi espacio"
        trailing={
          <HeaderIconButton accessibilityLabel="Ajustes" onPress={() => router.push("/ajustes")} testID="mi-espacio-ajustes">
            <Icon color={color.inkMuted} name="gear" size="sm" />
          </HeaderIconButton>
        }
      />

      <ListCard testID="mi-espacio-privacidad" tone="sunk">
        <Text style={[styles.privacyCopy, { color: color.inkMuted }]}>
          Solo vos ves esto. Se guarda en tu cuenta y se borra si eliminás la cuenta.
        </Text>
        <ListRow
          accessibilityHint="Abre la política en el navegador"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          testID="mi-espacio-politica-privacidad"
          title="Política de privacidad"
          trailing={<Text style={[styles.glyph, { color: color.inkFaint }]}>↗</Text>}
        />
      </ListCard>

      {MY_SPACE_GROUPS.map((group) => (
        <GroupBlock key={group.id} label={group.label}>
          {sections
            .filter((section) => section.group === group.id)
            .map((section) => (
              <ListRow
                accessibilityHint={section.count > 0 ? `Abre ${section.title.toLowerCase()}.` : undefined}
                accessibilityLabel={`${section.title}, ${section.count}`}
                action={section.action}
                actionMuted={section.count === 0}
                count={loading ? null : section.count}
                disabled={loading}
                hint={section.count > 0 ? undefined : section.detail}
                key={section.id}
                latest={section.count > 0 ? section.detail : undefined}
                onPress={() => go(section.destination)}
                testID={`mi-espacio-${section.id}`}
                title={section.title}
              />
            ))}
          {group.id === "fe" ? (
            <ListRow
              accessibilityHint="Abre el resumen de tu año."
              action="Abrir"
              hint={yearEntry.hint}
              onPress={() => router.push("/tu-ano")}
              testID="mi-espacio-tu-ano"
              title={yearEntry.title}
            />
          ) : null}
        </GroupBlock>
      ))}

      {/* Exportar lo mío (#173): la única entrada, además de "Eliminar mi cuenta" (#232). */}
      <ListSectionLabel>Llevártelo</ListSectionLabel>
      <ListCard>
        <ListRow
          hint="Guardados, notas, subrayados, oración y notas de prédica, en texto o PDF"
          onPress={() => router.push("/exportar")}
          testID="mi-espacio-exportar"
          title="Exportar lo mío"
        />
      </ListCard>

      {/* Tus fechas (#204): cumpleaños y bautismo o conversión. */}
      <PersonalDatesSection user={me} />
    </AppScreen>
  );
}

function GroupBlock({ children, label }: { children: ReactNode; label: string }) {
  return (
    <>
      <ListSectionLabel>{label}</ListSectionLabel>
      <ListCard>{children}</ListCard>
    </>
  );
}

/** "Proteger lo personal" (#171): si está encendido, nada se monta hasta autenticar. */
export default function MiEspacioRoute() {
  return (
    <PersonalLockGate>
      <MiEspacioScreen />
    </PersonalLockGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: 0 },
  header: { marginBottom: tokens.space.xl },
  privacyCopy: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.bodySm.size,
    lineHeight: tokens.type.bodySm.lineHeight,
    paddingHorizontal: tokens.cardPadding.horizontal,
    paddingVertical: tokens.cardPadding.vertical,
  },
  glyph: { fontFamily: tokens.font.sans, fontSize: tokens.type.body.size },
});
