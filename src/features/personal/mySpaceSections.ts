/**
 * Secciones de Mi espacio (#169): todo lo personal en un solo lugar. Cada
 * sección lleva a la pantalla que ya existe — acá no se duplica ninguna lista,
 * solo se cuenta y se muestra lo último.
 *
 * Memorizar (#158), el diario de oración (#159) y las notas de prédica (#232)
 * tienen sección propia; las notas de versículo (#167) viven dentro de
 * Guardados. Desde #232 Mi espacio es una pestaña y el historial es uno solo:
 * "Mis conversaciones" junta Preguntar, Sentir y Voces (antes eran dos
 * renglones acá, más Ajustes y los cajones).
 */

type VerseRef = { book: string; chapter: number; verse: number };

export type MySpaceSectionId =
  | "separator"
  | "bookmarks"
  | "highlights"
  | "memorize"
  | "prayers"
  | "sermonNotes"
  | "conversations"
  | "friends";

/** Los grupos de la pantalla, en orden (#232). */
export type MySpaceGroup = "biblia" | "fe" | "conversaciones";
export const MY_SPACE_GROUPS: ReadonlyArray<{ id: MySpaceGroup; label: string }> = [
  { id: "biblia", label: "Tu Biblia" },
  { id: "fe", label: "Tu vida de fe" },
  { id: "conversaciones", label: "Conversaciones" },
];

export type MySpaceDestination =
  | { kind: "passage"; passage: VerseRef }
  | {
      kind: "route";
      href:
        | "/leer"
        | "/leer/guardados"
        | "/leer/subrayados"
        | "/historial"
        | "/preguntar"
        | "/memorizar"
        | "/oracion"
        | "/notas"
        | "/amigos";
    };

export type MySpaceSection = {
  id: MySpaceSectionId;
  group: MySpaceGroup;
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
  /** Versículos en Memorizar y cuántos tocan hoy. */
  memorize: { total: number; dueCount: number };
  /** Peticiones del diario de oración, abiertas primero. */
  prayers: Array<{ text: string; answeredAt: number | null }>;
  /** Notas de prédica, la más reciente primero, con su título para mostrar. */
  sermonNotes: Array<{ displayTitle: string }>;
  /** Amigos (1.0.3): cuántos, solicitudes recibidas y mensajes sin leer. */
  friends?: { friends: number; requests: number; unread: number };
};

function friendsDetail({ friends, requests, unread }: { friends: number; requests: number; unread: number }): string {
  if (unread > 0) return unread === 1 ? "1 mensaje sin leer" : `${unread > 99 ? "99+" : unread} mensajes sin leer`;
  if (requests > 0) return requests === 1 ? "1 solicitud de amistad" : `${requests} solicitudes de amistad`;
  if (friends > 0) return "Escribiles o mandales un versículo";
  return "Agregá a alguien con su código y mándense versículos por el chat de la app.";
}

const formatRef = (ref: VerseRef) => `${ref.book} ${ref.chapter}:${ref.verse}`;

const VIEW_ALL = "Ver todo";
const START = "Empezar";

export function buildMySpaceSections(data: MySpaceData): MySpaceSection[] {
  const openPrayers = data.prayers.filter((item) => item.answeredAt === null);
  const answeredPrayers = data.prayers.length - openPrayers.length;
  const { total: memorizing, dueCount } = data.memorize;
  const friends = data.friends ?? { friends: 0, requests: 0, unread: 0 };
  const friendsPending = friends.unread > 0 || friends.requests > 0;

  return [
    {
      id: "separator",
      group: "biblia",
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
      group: "biblia",
      title: "Guardados",
      count: data.bookmarks.length,
      detail: data.bookmarks[0]
        ? formatRef(data.bookmarks[0])
        : "Versículos para tener a mano. En el lector, tocá uno y elegí «Guardar».",
      action: data.bookmarks.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: data.bookmarks.length > 0 ? "/leer/guardados" : "/leer" },
    },
    {
      id: "highlights",
      group: "biblia",
      title: "Subrayados",
      count: data.highlights.length,
      detail: data.highlights[0]
        ? formatRef(data.highlights[0])
        : "Como el resaltador de una Biblia de papel. En el lector, tocá un versículo y elegí un color.",
      action: data.highlights.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: data.highlights.length > 0 ? "/leer/subrayados" : "/leer" },
    },
    {
      id: "memorize",
      group: "fe",
      title: "Memorizar",
      count: memorizing,
      detail:
        memorizing === 0
          ? "Versículos para aprender de memoria. En el lector, tocá uno y elegí «Memorizar»."
          : dueCount > 0
            ? dueCount === 1
              ? "1 versículo para repasar hoy"
              : `${dueCount} versículos para repasar hoy`
            : "Nada para repasar hoy. Volvé mañana.",
      action: dueCount > 0 ? "Repasar" : memorizing > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: memorizing > 0 ? "/memorizar" : "/leer" },
    },
    {
      id: "prayers",
      group: "fe",
      title: "Diario de oración",
      count: data.prayers.length,
      detail:
        openPrayers[0]?.text ??
        (answeredPrayers > 0
          ? answeredPrayers === 1
            ? "1 petición respondida"
            : `${answeredPrayers} peticiones respondidas`
          : "Tus peticiones, privadas. Guardalas al terminar un devocional de Sentir o escribilas aquí."),
      action: data.prayers.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: "/oracion" },
    },
    {
      id: "sermonNotes",
      group: "fe",
      title: "Notas de prédica",
      count: data.sermonNotes.length,
      detail: data.sermonNotes[0]?.displayTitle ?? "Lo que anotás en el culto, con los pasajes a un toque. Funciona sin señal.",
      action: data.sermonNotes.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: "/notas" },
    },
    {
      id: "conversations",
      group: "conversaciones",
      title: "Mis conversaciones",
      count: data.history.length,
      detail: data.history[0]?.title ?? "Tus preguntas, tus devocionales de Sentir y tus charlas con personajes quedan aquí.",
      action: data.history.length > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: data.history.length > 0 ? "/historial" : "/preguntar" },
    },
    {
      id: "friends",
      group: "conversaciones",
      title: "Amigos",
      // Con solicitudes y sin amigos todavía, el número no puede decir 0.
      count: friends.friends + (friends.friends === 0 ? friends.requests : 0),
      detail: friendsDetail(friends),
      action: friendsPending ? "Abrir" : friends.friends > 0 ? VIEW_ALL : START,
      destination: { kind: "route", href: "/amigos" },
    },
  ];
}
