import type { IconName } from "../../components/Icon";
import { copyToClipboard } from "../../lib/clipboard";
import { goToChat } from "../../lib/goToChat";
import { goToVoices } from "../../lib/goToVoices";
import { openDedication, openSermonNotePicker, openTimeline } from "../../lib/openPassage";
import { track } from "../../lib/telemetry";
import { voiceDraftFor, type ChapterVoice } from "./chapterVoice";
import { hasCrossReferences } from "./crossReferences";
import { openRelatedPassages } from "./openRelatedPassages";
import { buildVerseCopyText, shareVerse, type ReadingVerse } from "./shareVerse";
import { eraForChapter } from "./timeline";

/**
 * Registro de acciones del versículo (#196, U4). La hoja del lector pinta esta
 * lista en una cuadrícula, en este orden. Para sumar una acción (Dedicar #202,
 * Relacionados #187, Memorizar #158, ¿Cuándo pasó esto? #201) se agrega una
 * entrada acá y, si hace falta, un ícono en `Icon.tsx`: la pantalla no cambia.
 *
 * Las acciones que tocan estado del lector (guardar, nota, separador) llaman a
 * los manejadores que la pantalla pone en el contexto; las que solo navegan o
 * comparten se resuelven acá con el versículo.
 *
 * Desde #232 (Fase 3) la hoja muestra solo las `primary` (Guardar, Nota,
 * Compartir, Preguntar) y un "Más" que despliega el resto. Una acción nueva
 * entra en "Más" salvo que se decida otra cosa: la fila de arriba no crece.
 */
export type VerseActionContext = {
  verse: ReadingVerse;
  signedIn: boolean;
  saved: boolean;
  hasNote: boolean;
  isSeparator: boolean;
  referralCode: string | null;
  voice: ChapterVoice | null;
  toggleSave: () => void;
  openNote: () => void;
  toggleSeparator: () => void;
  /** Memorizar (#158): el versículo ya está en el repaso. */
  memorizing: boolean;
  toggleMemorize: () => void;
  /** Escuchar el capítulo desde este versículo (#157). */
  listenFrom: () => void;
};

export type VerseAction = {
  id: string;
  icon: IconName;
  label: (ctx: VerseActionContext) => string;
  /** Lo que lee el lector de pantalla cuando la etiqueta corta no alcanza. */
  accessibilityLabel?: (ctx: VerseActionContext) => string;
  accessibilityHint?: (ctx: VerseActionContext) => string | undefined;
  testID: string;
  visible?: (ctx: VerseActionContext) => boolean;
  disabled?: (ctx: VerseActionContext) => boolean;
  /** Activo = ícono en `accent` (guardado, es el separador, tiene nota). */
  active?: (ctx: VerseActionContext) => boolean;
  /** Activo y además relleno (design/oleada-ux.md §U4). */
  fillWhenActive?: boolean;
  /** Va en la fila de arriba; el resto queda detrás de "Más" (#232). */
  primary?: boolean;
  onPress: (ctx: VerseActionContext) => void;
};

export const VERSE_ACTIONS: readonly VerseAction[] = [
  {
    id: "save",
    primary: true,
    icon: "bookmark",
    label: (ctx) => (ctx.saved ? "Guardado" : "Guardar"),
    accessibilityLabel: (ctx) => (ctx.saved ? "Guardado. Tocá para quitarlo" : "Guardar"),
    testID: "reading-save-toggle",
    active: (ctx) => ctx.saved,
    fillWhenActive: true,
    onPress: (ctx) => ctx.toggleSave(),
  },
  {
    id: "note",
    primary: true,
    icon: "note",
    label: () => "Nota",
    accessibilityLabel: (ctx) => (ctx.hasNote ? "Editar nota" : "Agregar nota"),
    testID: "reading-note-open",
    visible: (ctx) => ctx.signedIn,
    active: (ctx) => ctx.hasNote,
    onPress: (ctx) => ctx.openNote(),
  },
  {
    id: "separator",
    icon: "ribbon",
    label: () => "Separador",
    accessibilityLabel: (ctx) => (ctx.isSeparator ? "Quitar el separador" : "Poner el separador aquí"),
    testID: "reading-separator-toggle",
    visible: (ctx) => ctx.signedIn,
    active: (ctx) => ctx.isSeparator,
    fillWhenActive: true,
    onPress: (ctx) => ctx.toggleSeparator(),
  },
  {
    // Memorizar (#158): repaso espaciado. Se quita tocándolo otra vez.
    id: "memorize",
    icon: "refresh",
    label: (ctx) => (ctx.memorizing ? "Memorizando" : "Memorizar"),
    accessibilityHint: (ctx) =>
      ctx.memorizing ? "Lo saca de tu repaso de Memorizar." : "Lo agrega a Memorizar. Aparece en tu repaso de mañana.",
    testID: "reading-memorize-toggle",
    visible: (ctx) => ctx.signedIn,
    active: (ctx) => ctx.memorizing,
    onPress: (ctx) => ctx.toggleMemorize(),
  },
  {
    id: "share",
    primary: true,
    icon: "share",
    label: () => "Compartir",
    testID: "reading-action-share",
    disabled: (ctx) => !ctx.referralCode,
    onPress: (ctx) => {
      if (!ctx.referralCode) return;
      void shareVerse({ verse: ctx.verse, referralCode: ctx.referralCode });
    },
  },
  {
    // Dedicar (#202): imagen "Para …" por WhatsApp. Gratis: es el canal de crecimiento.
    id: "dedicate",
    icon: "gift",
    label: () => "Dedicar",
    accessibilityLabel: () => "Dedicar este versículo",
    accessibilityHint: () => "Arma una imagen con el versículo y una dedicatoria para mandar por WhatsApp.",
    testID: "reading-action-dedicate",
    onPress: (ctx) => openDedication(ctx.verse),
  },
  {
    // Escuchar (#157): voz del sistema desde este versículo. Gratis, sin cuota.
    id: "listen",
    icon: "listen",
    label: () => "Escuchar",
    accessibilityLabel: () => "Escuchar desde este versículo",
    testID: "reading-action-listen",
    onPress: (ctx) => ctx.listenFrom(),
  },
  {
    id: "ask",
    primary: true,
    icon: "chat",
    label: () => "Preguntar",
    accessibilityLabel: () => "Preguntar sobre esto",
    testID: "reading-action-ask",
    onPress: (ctx) => goToChat(ctx.verse),
  },
  {
    // Referencias cruzadas (#187): índice fijo, no IA. Solo si el versículo tiene.
    id: "related",
    icon: "book",
    label: () => "Relacionados",
    accessibilityLabel: () => "Ver pasajes relacionados",
    testID: "reading-action-related",
    visible: (ctx) => hasCrossReferences(ctx.verse),
    onPress: (ctx) => openRelatedPassages(ctx.verse),
  },
  {
    // Puente Lectura → Voces: si el capítulo lo vivió o lo escribió un
    // personaje del catálogo. Voces sigue pasando por su cuota (regla dura
    // #3); acá solo se navega.
    id: "voice",
    icon: "voice",
    label: (ctx) => `Hablar con ${ctx.voice?.name ?? ""}`,
    accessibilityHint: (ctx) => (ctx.voice ? `Abre Voces con ${ctx.voice.name} y deja escrito este versículo.` : undefined),
    testID: "reading-talk-to-voice",
    visible: (ctx) => ctx.voice !== null,
    onPress: (ctx) => {
      if (!ctx.voice) return;
      track("reader_voice_opened");
      goToVoices(ctx.voice.slug, {
        draft: voiceDraftFor(`${ctx.verse.book} ${ctx.verse.chapter}:${ctx.verse.verse}`, ctx.voice.role),
      });
    },
  },
  {
    // Línea del tiempo (#201): abre en la época del capítulo (Rut 1 → Los
    // jueces). Solo si el capítulo cae en alguna época curada.
    id: "timeline",
    icon: "clock",
    label: () => "¿Cuándo pasó esto?",
    accessibilityHint: (ctx) => {
      const era = eraForChapter(ctx.verse.book, ctx.verse.chapter);
      return era ? `Abre la línea del tiempo en ${era.name.toLowerCase()}.` : undefined;
    },
    testID: "reading-timeline",
    visible: (ctx) => eraForChapter(ctx.verse.book, ctx.verse.chapter) !== null,
    onPress: (ctx) => {
      const era = eraForChapter(ctx.verse.book, ctx.verse.chapter);
      if (era) openTimeline(era.id);
    },
  },
  {
    // Notas de prédica (#232): suma el versículo a una nota (nueva o reciente).
    // Va en "Más", sin sumar una acción principal.
    id: "sermon",
    icon: "sermon",
    label: () => "Nota de prédica",
    accessibilityLabel: () => "Agregar a nota de prédica",
    accessibilityHint: () => "Elegí una nota de prédica o empezá una nueva con este versículo.",
    testID: "reading-action-sermon",
    visible: (ctx) => ctx.signedIn,
    onPress: (ctx) => openSermonNotePicker(ctx.verse),
  },
  {
    id: "copy",
    icon: "copy",
    label: () => "Copiar",
    testID: "reading-action-copy",
    onPress: (ctx) => void copyToClipboard(buildVerseCopyText(ctx.verse)),
  },
];

export function visibleVerseActions(ctx: VerseActionContext, actions: readonly VerseAction[] = VERSE_ACTIONS): VerseAction[] {
  return actions.filter((action) => action.visible?.(ctx) ?? true);
}

/** Las acciones de la fila de arriba y las de "Más", en el orden del registro (#232). */
export function splitVerseActions(actions: readonly VerseAction[]): { primary: VerseAction[]; more: VerseAction[] } {
  return {
    primary: actions.filter((action) => action.primary === true),
    more: actions.filter((action) => action.primary !== true),
  };
}
