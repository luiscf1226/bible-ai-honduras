import { storyPalettes, type StoryPalette, type StorySeason } from "../home/storyPalettes";
import {
  estimateLines,
  fittingStoryFormats,
  serifCharsPerLine,
  type DedicationBlock,
  type StoryFormat,
} from "../home/verseStoryLayout";
import { tokens } from "../../theme/tokens";

/**
 * Versículo dedicado (#202, design/dedicar-y-escuchar.md §Dedicar): "Para mi
 * mamá" como imagen para regalar por WhatsApp.
 *
 * Todo se arma en el teléfono. La dedicatoria **no se guarda en el servidor ni
 * se publica en la app**: vive en el estado de la pantalla y sale en la
 * imagen. El versículo es el texto del corpus en la versión de la persona,
 * tal cual (regla dura #4).
 */

export const DEDICATION_TO_MAX = 28;
export const DEDICATION_MESSAGE_MAX = 90;
// Renglones de la dedicatoria: con 90 caracteres entran en 2 o 3.
const MESSAGE_MAX_LINES = 3;
const TO_MAX_LINES = 2;

export type DedicationTemplateId = "clasica" | "noche" | "temporada" | "cumpleanos";

/** Colores de una plantilla: los fondos lisos compartidos con "Crear imagen" (`storyPalettes`). */
export type DedicationPalette = StoryPalette;

export type DedicationTemplate = {
  id: DedicationTemplateId;
  /** Nombre en el selector. */
  label: string;
  /** Título chico arriba de la imagen (`overline`). */
  overline: string;
  palette: DedicationPalette;
};

/**
 * Plantillas disponibles hoy. Clásica y Noche siempre; la de la temporada
 * activa (#199) solo mientras dura, con su nombre y su acento; Cumpleaños
 * siempre (es lo que más se regala; es el fondo Arena).
 */
export function dedicationTemplates(season?: StorySeason): DedicationTemplate[] {
  return storyPalettes(season).map(({ id, palette }): DedicationTemplate => {
    if (id === "noche") return { id, label: "Noche", overline: "Con cariño", palette };
    if (id === "temporada") return { id, label: season?.name ?? "", overline: season?.name ?? "", palette };
    if (id === "arena") return { id: "cumpleanos", label: "Cumpleaños", overline: "Feliz cumpleaños", palette };
    return { id, label: "Clásica", overline: "Con cariño", palette };
  });
}

/** Con temporada activa arranca en su plantilla; si no, en la clásica. */
export function defaultTemplateId(templates: readonly DedicationTemplate[]): DedicationTemplateId {
  return templates.some((template) => template.id === "temporada") ? "temporada" : "clasica";
}

/** Una sola línea, sin espacios de más, dentro del tope. */
export function cleanDedicationTo(value: string): string {
  return value.replace(/\s+/g, " ").trimStart().slice(0, DEDICATION_TO_MAX);
}

/** La dedicatoria admite saltos de línea del teclado, pero en la imagen va corrida. */
export function cleanDedicationMessage(value: string): string {
  return value.replace(/\s+/g, " ").trimStart().slice(0, DEDICATION_MESSAGE_MAX);
}

/** Lo que va en la imagen: "Para Mamá". */
export function dedicationToLine(to: string): string {
  return `Para ${to.trim()}`;
}

/**
 * Mide el bloque "Para …" y la dedicatoria. El nombre baja de
 * `dedicationTo` a `dedicationToMin` hasta entrar en un renglón; si no
 * entra, usa dos. Así un nombre largo nunca rompe la imagen.
 */
export function dedicationBlock(to: string, message: string, image = tokens.storyImage): DedicationBlock {
  const toText = dedicationToLine(to);
  let toSize = image.dedicationTo;
  while (toSize > image.dedicationToMin && estimateLines(toText, serifCharsPerLine(toSize, image)) > 1) {
    toSize -= 2;
  }
  const toLines = Math.min(TO_MAX_LINES, Math.max(1, estimateLines(toText, serifCharsPerLine(toSize, image))));
  const trimmed = message.trim();
  const messageLines = trimmed
    ? Math.min(MESSAGE_MAX_LINES, estimateLines(`“${trimmed}”`, serifCharsPerLine(image.dedicationMessage, image)))
    : 0;
  return { toSize, toLines, messageLines };
}

export const DEDICATION_FORMATS: readonly { id: StoryFormat; label: string }[] = [
  { id: "story", label: "Estado · 9:16" },
  { id: "square", label: "Chat · cuadrada" },
];

/**
 * Formatos en los que el versículo entra entero (#202: el texto va "sin
 * editar", nunca cortado). Los versículos muy largos solo entran en 9:16.
 */
export function fittingFormats(verseText: string, block: DedicationBlock, image = tokens.storyImage): StoryFormat[] {
  return fittingStoryFormats(`“${verseText}”`, { withSeason: true, dedication: block }, image);
}

/**
 * Texto que acompaña la imagen (corto: la imagen ya lo dice todo).
 * `shareImage` le agrega el link con el código de invitación.
 */
export function buildDedicationShareText(params: { to: string; reference: string; version: string }): string {
  return `Un versículo para ${params.to.trim()} · ${params.reference} (${params.version})`;
}
