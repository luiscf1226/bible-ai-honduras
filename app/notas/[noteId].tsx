import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { DEFAULT_BIBLE_VERSION } from "../../convex/bibleVersions";
import { SERMON_NOTE_LIMITS } from "../../convex/sermonNotesCore";
import { AppButton } from "../../src/components/AppButton";
import { AppScreen } from "../../src/components/AppScreen";
import { Chip } from "../../src/components/Chip";
import { Icon } from "../../src/components/Icon";
import { ListCard, ListRow } from "../../src/components/ListRow";
import { PersonalLockGate } from "../../src/components/PersonalLockGate";
import { HeaderIconButton, ScreenHeader, goBackOrHome } from "../../src/components/ScreenHeader";
import { Switch } from "../../src/components/Switch";
import { PassageSheet } from "../../src/features/qa/PassageSheet";
import {
  addSermonPassage,
  buildSermonShareText,
  emptySermonNote,
  isEmptySermonNote,
  lastUsedChurchAndPreacher,
  newSermonClientId,
  removeSermonPassage,
  sermonDateLabel,
  sermonPassageLabel,
  sermonToday,
  shiftDateKey,
  type SermonNote,
} from "../../src/features/sermonNotes/sermonNotes";
import { useSermonNotes } from "../../src/features/sermonNotes/useSermonNotes";
import { openPassage } from "../../src/lib/openPassage";
import { shareContent, sharePlainText } from "../../src/lib/share";
import { track } from "../../src/lib/telemetry";
import { useTheme } from "../../src/theme/ThemeProvider";
import { tokens } from "../../src/theme/tokens";

/** Espera antes de guardar mientras se escribe: cada tecla no es un viaje a la cola. */
const AUTOSAVE_MS = 700;

type Params = { noteId?: string; book?: string; chapter?: string; verse?: string };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Editor de una nota de prédica (#232, design/oleada-ux.md §Notas de prédica).
 * `noteId` es el `clientId` de la nota, o `nueva`. Desde la hoja del versículo
 * llega con `book`/`chapter`/`verse` y el pasaje ya puesto.
 *
 * Se guarda solo (sin botón "Guardar"): cada cambio entra a la cola sin
 * conexión y sube cuando hay señal. Nada de esto pasa por la IA: la app no
 * resume, no corrige ni opina sobre la prédica (regla dura #4).
 */
function NotaScreen() {
  const { color } = useTheme();
  const params = useLocalSearchParams<Params>();
  const noteId = first(params.noteId) ?? "nueva";
  const { notes, online, remove, save } = useSermonNotes();
  const currentUser = useQuery(api.users.current);
  const version = currentUser?.bibleVersion ?? DEFAULT_BIBLE_VERSION;

  const [draft, setDraft] = useState<SermonNote | null>(null);
  const isNew = useRef(noteId === "nueva");
  const dirty = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const today = sermonToday();

  // Arranca una sola vez: la nota existente cuando llega la lista, o una vacía
  // con la iglesia y el predicador de la última (se recuerdan).
  // Una nota nueva no espera la lista: en el templo, sin señal y sin nada
  // guardado en el teléfono, la lista no llega nunca y hay que poder escribir igual.
  useEffect(() => {
    if (draft !== null) return;
    if (noteId !== "nueva") {
      const existing = notes?.find((note) => note.clientId === noteId);
      if (existing) setDraft(existing);
      return;
    }
    const fresh: SermonNote = emptySermonNote({ clientId: newSermonClientId(), today, lastUsed: lastUsedChurchAndPreacher(notes ?? []) });
    const book = first(params.book);
    const chapter = Number(first(params.chapter));
    const verse = Number(first(params.verse));
    if (book && Number.isInteger(chapter) && chapter > 0) {
      fresh.passages = [Number.isInteger(verse) && verse > 0 ? { book, chapter, verse } : { book, chapter }];
      dirty.current = true;
    }
    setDraft(fresh);
  }, [draft, noteId, notes, params.book, params.chapter, params.verse, today]);

  // Guarda solo, un rato después del último cambio.
  useEffect(() => {
    if (!draft || !dirty.current) return;
    const timer = setTimeout(() => flush(draft), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function flush(note: SermonNote | null) {
    if (!note || !dirty.current) return;
    if (save(note, { isNew: isNew.current })) {
      isNew.current = false;
      dirty.current = false;
    }
  }

  const update = (patch: Partial<SermonNote>) => {
    dirty.current = true;
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const back = () => {
    flush(draft);
    goBackOrHome();
  };

  if (!draft) {
    return (
      <AppScreen>
        <ScreenHeader onBack={back} title="Nota de prédica" />
        <Text style={[styles.hint, { color: color.inkSoft }]}>
          {notes === undefined ? "Abriendo tu nota…" : "Esta nota ya no está. Puede que la hayas borrado en otro teléfono."}
        </Text>
      </AppScreen>
    );
  }

  const pendingSync = !online || (notes?.find((note) => note.clientId === draft.clientId)?.pending ?? false);
  const status = isEmptySermonNote(draft)
    ? "Escribí algo y se guarda solo."
    : pendingSync
      ? "Guardada en el teléfono. Se sube cuando haya señal."
      : "Guardada.";

  async function share() {
    if (!draft) return;
    flush(draft);
    setShareNotice(null);
    const text = buildSermonShareText(draft, { includeNotes });
    const result = currentUser?.referralCode ? await shareContent({ text, referralCode: currentUser.referralCode }) : await sharePlainText(text);
    if (result.status === "shared") track("sermon_note_shared");
    if (result.status === "error") setShareNotice("No pudimos abrir la hoja para compartir. Probá de nuevo.");
  }

  function deleteNote() {
    if (!draft) return;
    dirty.current = false;
    if (!isNew.current) remove(draft.clientId);
    goBackOrHome();
  }

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <ScreenHeader onBack={back} title={noteId === "nueva" ? "Nueva nota" : "Nota de prédica"} titleSize="pick" />

      <TextInput
        accessibilityLabel="Título de la prédica"
        maxLength={SERMON_NOTE_LIMITS.title}
        multiline
        onChangeText={(title) => update({ title })}
        placeholder="Título de la prédica"
        placeholderTextColor={color.inkFaint}
        style={[styles.title, { color: color.ink }]}
        testID="nota-titulo"
        value={draft.title}
      />

      <ListCard>
        <ListRow
          title="Fecha"
          trailing={
            <View style={styles.stepper}>
              <HeaderIconButton accessibilityLabel="Un día antes" onPress={() => update({ date: shiftDateKey(draft.date, -1) })} testID="nota-fecha-antes">
                <Icon color={color.ink} name="back" size="sm" />
              </HeaderIconButton>
              <HeaderIconButton
                accessibilityLabel="Un día después"
                onPress={() => update({ date: shiftDateKey(draft.date, 1, today) })}
                testID="nota-fecha-despues"
              >
                <Icon color={draft.date >= today ? color.inkFaint : color.ink} name="chevronRight" size="sm" />
              </HeaderIconButton>
            </View>
          }
        >
          <Text style={[styles.dateValue, { color: color.inkMuted }]} testID="nota-fecha">
            {draft.date === today ? `Hoy · ${sermonDateLabel(draft.date)}` : sermonDateLabel(draft.date)}
          </Text>
        </ListRow>
        <Field
          label="Predicador"
          maxLength={SERMON_NOTE_LIMITS.preacher}
          onChange={(preacher) => update({ preacher })}
          placeholder="Opcional"
          testID="nota-predicador"
          value={draft.preacher ?? ""}
        />
        <Field
          label="Iglesia"
          maxLength={SERMON_NOTE_LIMITS.church}
          onChange={(church) => update({ church })}
          placeholder="Opcional"
          testID="nota-iglesia"
          value={draft.church ?? ""}
        />
      </ListCard>

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.inkSoft }]}>PASAJES</Text>
        <View style={styles.chips} testID="nota-pasajes">
          {draft.passages.map((passage) => (
            <Chip
              accessibilityHint="Abre el pasaje en la Biblia."
              clearLabel={`Quitar ${sermonPassageLabel(passage)}`}
              icon="book"
              iconActive
              key={sermonPassageLabel(passage)}
              label={sermonPassageLabel(passage)}
              onClear={() => update({ passages: removeSermonPassage(draft.passages, passage) })}
              onPress={() => {
                flush(draft);
                openPassage(passage);
              }}
              serif
              testID={`nota-pasaje-${sermonPassageLabel(passage)}`}
            />
          ))}
          {draft.passages.length < SERMON_NOTE_LIMITS.passages ? (
            <Chip dashed icon="plus" label="Agregar pasaje" onPress={() => setSheetOpen(true)} testID="nota-agregar-pasaje" />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.overline, { color: color.inkSoft }]}>MIS NOTAS</Text>
        <TextInput
          accessibilityLabel="Mis notas de la prédica"
          maxLength={SERMON_NOTE_LIMITS.notes}
          multiline
          onChangeText={(notes) => update({ notes })}
          placeholder="Lo que vas escuchando: ideas, frases, preguntas."
          placeholderTextColor={color.inkFaint}
          style={[styles.notes, { backgroundColor: color.surface, borderColor: color.border, color: color.ink }]}
          testID="nota-notas"
          textAlignVertical="top"
          value={draft.notes}
        />
      </View>

      <View style={[styles.takeaway, { backgroundColor: color.surfaceSunk }]}>
        <Text style={[styles.overline, { color: color.accent }]}>¿QUÉ ME LLEVO?</Text>
        <TextInput
          accessibilityLabel="¿Qué me llevo? Una línea"
          maxLength={SERMON_NOTE_LIMITS.takeaway}
          multiline
          onChangeText={(takeaway) => update({ takeaway })}
          placeholder="Una línea para acordarte esta semana."
          placeholderTextColor={color.inkFaint}
          style={[styles.takeawayInput, { color: color.ink }]}
          testID="nota-me-llevo"
          value={draft.takeaway}
        />
      </View>

      <Text style={[styles.hint, { color: color.inkSoft }]} testID="nota-estado">
        {status}
      </Text>

      <ListCard>
        <ListRow
          hint="Si no, van el título, los pasajes y lo que te llevás."
          title="Incluir mis notas al compartir"
          trailing={<Switch accessibilityLabel="Incluir mis notas al compartir" onChange={setIncludeNotes} testID="nota-incluir-notas" value={includeNotes} />}
        />
      </ListCard>
      <AppButton disabled={isEmptySermonNote(draft)} icon="whatsapp" onPress={() => void share()} testID="nota-compartir" variant="secondary">
        Compartir por WhatsApp
      </AppButton>
      {shareNotice ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: color.accentDeep }]}>
          {shareNotice}
        </Text>
      ) : null}

      {confirmingDelete ? (
        <View style={[styles.confirm, { borderColor: color.border }]} testID="nota-borrar-confirmar">
          <Text style={[styles.hint, { color: color.inkMuted }]}>¿Borrar esta nota? No se puede deshacer.</Text>
          <AppButton onPress={deleteNote} testID="nota-borrar-si">
            Sí, borrar
          </AppButton>
          <AppButton onPress={() => setConfirmingDelete(false)} variant="quiet">
            Cancelar
          </AppButton>
        </View>
      ) : (
        <AppButton onPress={() => setConfirmingDelete(true)} testID="nota-borrar" variant="quiet">
          Borrar nota
        </AppButton>
      )}

      <PassageSheet
        onClose={() => setSheetOpen(false)}
        onSelect={(passage) => {
          setSheetOpen(false);
          update({ passages: addSermonPassage(draft.passages, passage, SERMON_NOTE_LIMITS.passages) });
        }}
        version={version}
        visible={sheetOpen}
      />
    </AppScreen>
  );
}

/** Un campo de una línea dentro de la tarjeta: rótulo arriba, texto abajo. */
function Field(props: { label: string; value: string; placeholder: string; maxLength: number; onChange: (value: string) => void; testID: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: color.ink }]}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        maxLength={props.maxLength}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={color.inkFaint}
        style={[styles.fieldInput, { color: color.ink }]}
        testID={props.testID}
        value={props.value}
      />
    </View>
  );
}

/** Privadas como el diario de oración: con el candado puesto, pide desbloqueo. */
export default function NotaRoute() {
  return (
    <PersonalLockGate>
      <NotaScreen />
    </PersonalLockGate>
  );
}

const styles = StyleSheet.create({
  content: { gap: tokens.space.lg, paddingBottom: tokens.space.xxl },
  title: {
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.title.size,
    lineHeight: tokens.type.title.lineHeight,
    paddingVertical: tokens.space.xs,
  },
  stepper: { flexDirection: "row", gap: tokens.space.sm },
  dateValue: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.caption.size,
    lineHeight: tokens.type.caption.lineHeight,
    marginTop: tokens.space.xs,
  },
  field: { paddingHorizontal: tokens.cardPadding.horizontal, paddingVertical: tokens.space.md },
  fieldLabel: { fontFamily: tokens.font.sans, fontSize: tokens.type.label.size, lineHeight: tokens.type.label.lineHeight },
  fieldInput: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.body.size,
    marginTop: tokens.space.xs,
    paddingVertical: tokens.space.xxs,
  },
  section: { gap: tokens.space.sm },
  overline: {
    fontFamily: tokens.font.sansLight,
    fontSize: tokens.type.overline.size,
    letterSpacing: tokens.type.overline.letterSpacing,
    lineHeight: tokens.type.overline.lineHeight,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm },
  notes: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    fontFamily: tokens.font.serif,
    fontSize: tokens.type.versePicker.size,
    lineHeight: tokens.type.versePicker.lineHeight,
    minHeight: tokens.size.noteEditorMin,
    paddingHorizontal: tokens.space.lg,
    paddingVertical: tokens.space.md,
  },
  takeaway: { borderRadius: tokens.radius.lg, gap: tokens.space.xs, paddingHorizontal: tokens.space.lg, paddingVertical: tokens.space.md },
  takeawayInput: { fontFamily: tokens.font.serif, fontSize: tokens.type.versePicker.size, lineHeight: tokens.type.versePicker.lineHeight },
  hint: { fontFamily: tokens.font.sansLight, fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight },
  confirm: { borderRadius: tokens.radius.lg, borderWidth: 1, gap: tokens.space.md, padding: tokens.space.lg },
});
