export type Testament = "antiguo" | "nuevo";

export type BibleBook = {
  name: string;
  chapters: number;
  testament: Testament;
  /**
   * Abreviaturas con las que la gente teclea el libro ("gn", "1co", "sal").
   * Se usan para filtrar en el buscador (#112) y para resolver una referencia
   * escrita a mano ("jn 3:16"). Todas en minúscula y sin tildes.
   */
  abbreviations: readonly string[];
};

// Cánon protestante completo (RV1909), 66 libros en orden estándar.
// Cantidad de capítulos por libro — dato factual de dominio público, no
// texto bíblico con licencia (eso es #5, ingerido aparte).
export const BIBLE_BOOKS: readonly BibleBook[] = [
  { name: "Génesis", chapters: 50, testament: "antiguo", abbreviations: ["gn", "gen"] },
  { name: "Éxodo", chapters: 40, testament: "antiguo", abbreviations: ["ex", "exo"] },
  { name: "Levítico", chapters: 27, testament: "antiguo", abbreviations: ["lv", "lev"] },
  { name: "Números", chapters: 36, testament: "antiguo", abbreviations: ["nm", "num"] },
  { name: "Deuteronomio", chapters: 34, testament: "antiguo", abbreviations: ["dt", "deu"] },
  { name: "Josué", chapters: 24, testament: "antiguo", abbreviations: ["jos"] },
  { name: "Jueces", chapters: 21, testament: "antiguo", abbreviations: ["jue", "jc"] },
  { name: "Rut", chapters: 4, testament: "antiguo", abbreviations: ["rt"] },
  { name: "1 Samuel", chapters: 31, testament: "antiguo", abbreviations: ["1s", "1sa"] },
  { name: "2 Samuel", chapters: 24, testament: "antiguo", abbreviations: ["2s", "2sa"] },
  { name: "1 Reyes", chapters: 22, testament: "antiguo", abbreviations: ["1r", "1re"] },
  { name: "2 Reyes", chapters: 25, testament: "antiguo", abbreviations: ["2r", "2re"] },
  { name: "1 Crónicas", chapters: 29, testament: "antiguo", abbreviations: ["1cr"] },
  { name: "2 Crónicas", chapters: 36, testament: "antiguo", abbreviations: ["2cr"] },
  { name: "Esdras", chapters: 10, testament: "antiguo", abbreviations: ["esd"] },
  { name: "Nehemías", chapters: 13, testament: "antiguo", abbreviations: ["neh"] },
  { name: "Ester", chapters: 10, testament: "antiguo", abbreviations: ["est"] },
  { name: "Job", chapters: 42, testament: "antiguo", abbreviations: ["job"] },
  { name: "Salmos", chapters: 150, testament: "antiguo", abbreviations: ["sal", "sl"] },
  { name: "Proverbios", chapters: 31, testament: "antiguo", abbreviations: ["pr", "pro"] },
  { name: "Eclesiastés", chapters: 12, testament: "antiguo", abbreviations: ["ec", "ecl"] },
  { name: "Cantares", chapters: 8, testament: "antiguo", abbreviations: ["cnt", "cant"] },
  { name: "Isaías", chapters: 66, testament: "antiguo", abbreviations: ["is", "isa"] },
  { name: "Jeremías", chapters: 52, testament: "antiguo", abbreviations: ["jer", "jr"] },
  { name: "Lamentaciones", chapters: 5, testament: "antiguo", abbreviations: ["lm", "lam"] },
  { name: "Ezequiel", chapters: 48, testament: "antiguo", abbreviations: ["ez", "eze"] },
  { name: "Daniel", chapters: 12, testament: "antiguo", abbreviations: ["dn", "dan"] },
  { name: "Oseas", chapters: 14, testament: "antiguo", abbreviations: ["os", "ose"] },
  { name: "Joel", chapters: 3, testament: "antiguo", abbreviations: ["jl", "joe"] },
  { name: "Amós", chapters: 9, testament: "antiguo", abbreviations: ["am", "amo"] },
  { name: "Abdías", chapters: 1, testament: "antiguo", abbreviations: ["abd"] },
  { name: "Jonás", chapters: 4, testament: "antiguo", abbreviations: ["jon"] },
  { name: "Miqueas", chapters: 7, testament: "antiguo", abbreviations: ["mi", "miq"] },
  { name: "Nahúm", chapters: 3, testament: "antiguo", abbreviations: ["nah"] },
  { name: "Habacuc", chapters: 3, testament: "antiguo", abbreviations: ["hab"] },
  { name: "Sofonías", chapters: 3, testament: "antiguo", abbreviations: ["sof"] },
  { name: "Hageo", chapters: 2, testament: "antiguo", abbreviations: ["hag"] },
  { name: "Zacarías", chapters: 14, testament: "antiguo", abbreviations: ["zac"] },
  { name: "Malaquías", chapters: 4, testament: "antiguo", abbreviations: ["mal"] },
  { name: "Mateo", chapters: 28, testament: "nuevo", abbreviations: ["mt", "mat"] },
  { name: "Marcos", chapters: 16, testament: "nuevo", abbreviations: ["mr", "mc", "mar"] },
  { name: "Lucas", chapters: 24, testament: "nuevo", abbreviations: ["lc", "luc"] },
  { name: "Juan", chapters: 21, testament: "nuevo", abbreviations: ["jn", "jua"] },
  { name: "Hechos", chapters: 28, testament: "nuevo", abbreviations: ["hch", "hec"] },
  { name: "Romanos", chapters: 16, testament: "nuevo", abbreviations: ["ro", "rom"] },
  { name: "1 Corintios", chapters: 16, testament: "nuevo", abbreviations: ["1co", "1cor"] },
  { name: "2 Corintios", chapters: 13, testament: "nuevo", abbreviations: ["2co", "2cor"] },
  { name: "Gálatas", chapters: 6, testament: "nuevo", abbreviations: ["ga", "gal"] },
  { name: "Efesios", chapters: 6, testament: "nuevo", abbreviations: ["ef", "efe"] },
  { name: "Filipenses", chapters: 4, testament: "nuevo", abbreviations: ["fil", "flp"] },
  { name: "Colosenses", chapters: 4, testament: "nuevo", abbreviations: ["col"] },
  { name: "1 Tesalonicenses", chapters: 5, testament: "nuevo", abbreviations: ["1ts", "1te", "1tes"] },
  { name: "2 Tesalonicenses", chapters: 3, testament: "nuevo", abbreviations: ["2ts", "2te", "2tes"] },
  { name: "1 Timoteo", chapters: 6, testament: "nuevo", abbreviations: ["1ti", "1tim"] },
  { name: "2 Timoteo", chapters: 4, testament: "nuevo", abbreviations: ["2ti", "2tim"] },
  { name: "Tito", chapters: 3, testament: "nuevo", abbreviations: ["tit"] },
  { name: "Filemón", chapters: 1, testament: "nuevo", abbreviations: ["flm", "film"] },
  { name: "Hebreos", chapters: 13, testament: "nuevo", abbreviations: ["he", "heb"] },
  { name: "Santiago", chapters: 5, testament: "nuevo", abbreviations: ["stg", "snt"] },
  { name: "1 Pedro", chapters: 5, testament: "nuevo", abbreviations: ["1p", "1pe"] },
  { name: "2 Pedro", chapters: 3, testament: "nuevo", abbreviations: ["2p", "2pe"] },
  { name: "1 Juan", chapters: 5, testament: "nuevo", abbreviations: ["1jn", "1ju"] },
  { name: "2 Juan", chapters: 1, testament: "nuevo", abbreviations: ["2jn", "2ju"] },
  { name: "3 Juan", chapters: 1, testament: "nuevo", abbreviations: ["3jn", "3ju"] },
  { name: "Judas", chapters: 1, testament: "nuevo", abbreviations: ["jud"] },
  { name: "Apocalipsis", chapters: 22, testament: "nuevo", abbreviations: ["ap", "apo"] },
];

export function chaptersFor(book: string): number {
  return BIBLE_BOOKS.find((entry) => entry.name === book)?.chapters ?? 0;
}

/** Posición del libro en el canon; -1 si el nombre no es un libro conocido. */
export function indexOfBook(book: string): number {
  return BIBLE_BOOKS.findIndex((entry) => entry.name === book);
}
