/**
 * Plegado de texto en español, compartido por todo lo que busca sin acentos:
 * el buscador de pasajes (#112) y el filtro de Historias (#145). Una sola
 * definición — si mañana hay que tratar la ñ o las ligaduras, se toca acá.
 */

/** minúsculas + sin tildes, conservando espacios. */
export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** normalizeText además sin espacios: "1 co" y "1co" son la misma cosa. */
export function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, "");
}
