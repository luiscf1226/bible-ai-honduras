import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { SERMON_NOTE_LIMITS } from "../../convex/sermonNotesCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { ListCard, ListRow } from "../../src/components/ListRow";
import { PersonalLockGate } from "../../src/components/PersonalLockGate";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { addSermonPassage, sermonDateLabel, sermonDisplayTitle, sermonPassageLabel } from "../../src/features/sermonNotes/sermonNotes";
import { useSermonNotes } from "../../src/features/sermonNotes/useSermonNotes";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/** Cuántas notas recientes se ofrecen: las de los últimos domingos, no el cuaderno entero. */
const RECENT_COUNT = 5;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * "Agregar a nota de prédica" desde la hoja del versículo (#232): una nota
 * nueva con este pasaje, o sumarlo a una de las últimas. Al elegir, abre la
 * nota (sin apilar esta pantalla: volver lleva al lector).
 */
function AgregarScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<{ book?: string; chapter?: string; verse?: string }>();
  const book = first(params.book) ?? "";
  const chapter = Number(first(params.chapter));
  const verse = Number(first(params.verse));
  const passage = Number.isInteger(verse) && verse > 0 ? { book, chapter, verse } : { book, chapter };
  const valid = book.length > 0 && Number.isInteger(chapter) && chapter > 0;
  const { notes, save } = useSermonNotes();
  const recent = (notes ?? []).slice(0, RECENT_COUNT);

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader title="Agregar a nota de prédica" titleSize="pick" />
      <Text style={[styles.subtitle, { color: color.inkSoft }]}>{valid ? sermonPassageLabel(passage) : "Pasaje no válido"}</Text>

      <AppButton
        disabled={!valid}
        icon="plus"
        onPress={() =>
          router.replace({
            pathname: "/notas/[noteId]",
            params: { noteId: "nueva", book, chapter: String(chapter), ...(passage.verse ? { verse: String(passage.verse) } : {}) },
          })
        }
        testID="notas-agregar-nueva"
      >
        Nueva nota con este pasaje
      </AppButton>

      {recent.length > 0 ? (
        <>
          <Text style={[styles.overline, { color: color.inkSoft }]}>O SUMALO A UNA RECIENTE</Text>
          <ListCard>
            {recent.map((note) => {
              const passages = addSermonPassage(note.passages, passage, SERMON_NOTE_LIMITS.passages);
              const full = passages.length === note.passages.length && !note.passages.some((item) => sermonPassageLabel(item) === sermonPassageLabel(passage));
              return (
                <ListRow
                  disabled={!valid || full}
                  hint={full ? "Ya tiene el máximo de pasajes" : sermonDateLabel(note.date)}
                  key={note.clientId}
                  onPress={() => {
                    save({ ...note, passages }, { isNew: false });
                    router.replace({ pathname: "/notas/[noteId]", params: { noteId: note.clientId } });
                  }}
                  testID={`notas-agregar-${note.clientId}`}
                  title={sermonDisplayTitle(note)}
                />
              );
            })}
          </ListCard>
        </>
      ) : null}
    </AppScreen>
  );
}

export default function AgregarRoute() {
  return (
    <PersonalLockGate>
      <AgregarScreen />
    </PersonalLockGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg },
  subtitle: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.subtitle.size,
    lineHeight: tokens.type.subtitle.lineHeight,
    marginLeft: tokens.size.backButton + tokens.space.md,
    marginTop: -tokens.space.sm,
  },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
    marginTop: tokens.space.md,
  },
});
