import { BIBLE_BOOKS, type BibleBook, type Testament } from "../../lib/bibleBooks";

/**
 * Índice de `/leer` como el de una Biblia de papel (#195, U3): los 66 libros
 * agrupados por sección, en el orden del canon. Los nombres son los mismos de
 * `src/lib/bibleBooks.ts`, que es lo que resuelve `bookSearch.ts`; el test
 * verifica que cada libro aparezca exactamente una vez.
 */
export type CanonSectionId =
  | "ley"
  | "historia"
  | "poesia"
  | "profetasMayores"
  | "profetasMenores"
  | "evangelios"
  | "cartasPablo"
  | "cartasGenerales"
  | "apocalipsis";

export type CanonSection = {
  id: CanonSectionId;
  testament: Testament;
  /** Se muestra en `overline` (versalitas), por eso se guarda en caja normal. */
  title: string;
  books: readonly string[];
};

export const CANON_SECTIONS: readonly CanonSection[] = [
  { id: "ley", testament: "antiguo", title: "Ley", books: ["Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio"] },
  {
    id: "historia",
    testament: "antiguo",
    title: "Historia",
    books: [
      "Josué",
      "Jueces",
      "Rut",
      "1 Samuel",
      "2 Samuel",
      "1 Reyes",
      "2 Reyes",
      "1 Crónicas",
      "2 Crónicas",
      "Esdras",
      "Nehemías",
      "Ester",
    ],
  },
  { id: "poesia", testament: "antiguo", title: "Poesía", books: ["Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares"] },
  {
    id: "profetasMayores",
    testament: "antiguo",
    title: "Profetas mayores",
    books: ["Isaías", "Jeremías", "Lamentaciones", "Ezequiel", "Daniel"],
  },
  {
    id: "profetasMenores",
    testament: "antiguo",
    title: "Profetas menores",
    books: [
      "Oseas",
      "Joel",
      "Amós",
      "Abdías",
      "Jonás",
      "Miqueas",
      "Nahúm",
      "Habacuc",
      "Sofonías",
      "Hageo",
      "Zacarías",
      "Malaquías",
    ],
  },
  { id: "evangelios", testament: "nuevo", title: "Evangelios y Hechos", books: ["Mateo", "Marcos", "Lucas", "Juan", "Hechos"] },
  {
    id: "cartasPablo",
    testament: "nuevo",
    title: "Cartas de Pablo",
    books: [
      "Romanos",
      "1 Corintios",
      "2 Corintios",
      "Gálatas",
      "Efesios",
      "Filipenses",
      "Colosenses",
      "1 Tesalonicenses",
      "2 Tesalonicenses",
      "1 Timoteo",
      "2 Timoteo",
      "Tito",
      "Filemón",
    ],
  },
  {
    id: "cartasGenerales",
    testament: "nuevo",
    title: "Cartas generales",
    books: ["Hebreos", "Santiago", "1 Pedro", "2 Pedro", "1 Juan", "2 Juan", "3 Juan", "Judas"],
  },
  { id: "apocalipsis", testament: "nuevo", title: "Apocalipsis", books: ["Apocalipsis"] },
];

export function sectionsForTestament(testament: Testament): CanonSection[] {
  return CANON_SECTIONS.filter((section) => section.testament === testament);
}

/** Libros de una sección con sus datos del canon (capítulos, abreviaturas). */
export function booksOfSection(section: CanonSection): BibleBook[] {
  return section.books.flatMap((name) => BIBLE_BOOKS.find((book) => book.name === name) ?? []);
}

/**
 * Reparte una lista en dos columnas como el índice impreso: se lee hacia abajo
 * la izquierda y después la derecha, así el orden del canon no se cruza.
 */
export function splitInColumns<T>(items: readonly T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}
