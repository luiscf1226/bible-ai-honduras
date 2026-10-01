/**
 * Secciones de Mi espacio (#169): todo lo personal en un solo lugar. Cada
 * sección lleva a la pantalla que ya existe — acá no se duplica ninguna lista,
 * solo se cuenta y se muestra lo último.
 *
 * Las features que todavía no existen (peticiones #159, memorizar #158, notas
 * #167) no tienen sección: se agregan acá cuando lleguen.
 */

type VerseRef = { book: string; chapter: number; verse: number };

export type MySpaceSectionId = "separator" | "bookmarks" | "highlights" | "feelings" | "conversations";

export type MySpaceDestination =
  | { kind: "passage"; passage: VerseRef }
  | { kind: "route"; href: "/leer" | "/historial" | "/preguntar" }
  | { kind: "sentir"; openHistory: boolean };

export type MySpaceSection = {
  id: MySpaceSectionId;
  title: string;
  count: number;
  /** Lo último de la sección, o la explicación de cómo empezar si está vacía. */
  detail: string;
  /** "Ver todo" con contenido, "Empezar" vacía. */
  action: string;
  destination: MySpaceDestination;
};

export type MySpaceData = {
  separator: VerseRef | null;
  bookmarks: VerseRef[];
  highlights: VerseRef[];
  history: Array<{ module: "qa" | "voices" | "feelings"; title: string }>;
};

const formatRef = (ref: VerseRef) => `${ref.book} ${ref.chapter}:${ref.verse}`;

const VIEW_ALL = "Ver todo";
const START = "Empezar";

export function buildMySpaceSections(data: MySpaceData): MySpaceSection[] {
  const feelings = data.history.filter((item) => item.module === "feelings");
  const conversations = data.history.filter((item) => item.module !== "feelings");

  return [
    {
      id: "separator",
      title: "Separador",
      count: data.separator ? 1 : 0,
      detail: data.separator
        ? formatRef(data.separator)
        : "La cinta de tu Biblia. En el lector, tocá un versículo y elegí «Poner el separador aquí».",
      action: data.separator ? "Abrir" : START,
      destination: data.separator ? { kind: "passage", passage: data.separator } : { kind: "route", href: "/leer" },
    },
    {
      id: "bookmarks",
      title: "Guardados",
      count: data.bookmarks.length,
      detail: data.bookmarks[0]
        ? formatRef(data.bookmarks[0])
        : "Versículos para tener a mano. En el lector, tocá uno y elegí «Guardar».",
      action: data.bookmarks.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: "/leer" },
    },
    {
      id: "highlights",
      title: "Subrayados",
      count: data.highlights.length,
      detail: data.highlights[0]
        ? formatRef(data.highlights[0])
        : "Como el resaltador de una Biblia de papel. En el lector, tocá un versículo y elegí un color.",
      action: data.highlights.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: "/leer" },
    },
    {
      id: "feelings",
      title: "Devocionales de Sentir",
      count: feelings.length,
      detail: feelings[0]?.title ?? "Cuando contás cómo te sentís en Sentir, el devocional queda guardado aquí.",
      action: feelings.length > 0 ? VIEW_ALL : START,
      destination: { kind: "sentir", openHistory: feelings.length > 0 },
    },
    {
      id: "conversations",
      title: "Conversaciones",
      count: conversations.length,
      detail: conversations[0]?.title ?? "Tus preguntas sobre la Biblia y tus charlas con personajes quedan aquí.",
      action: conversations.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: conversations.length > 0 ? "/historial" : "/preguntar" },
    },
  ];
}
