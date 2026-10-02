import type { IconName } from "../../components/Icon";
import { copyToClipboard } from "../../lib/clipboard";
import { goToChat } from "../../lib/goToChat";
import { goToVoices } from "../../lib/goToVoices";
import { openTimeline } from "../../lib/openPassage";
import { track } from "../../lib/telemetry";
import { voiceDraftFor, type ChapterVoice } from "./chapterVoice";
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
  onPress: (ctx: VerseActionContext) => void;
};

export const VERSE_ACTIONS: readonly VerseAction[] = [
  {
    id: "save",
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
    id: "ask",
    icon: "chat",
    label: () => "Preguntar",
    accessibilityLabel: () => "Preguntar sobre esto",
    testID: "reading-action-ask",
    onPress: (ctx) => goToChat(ctx.verse),
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
