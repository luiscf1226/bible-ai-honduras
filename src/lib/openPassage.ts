import { router } from "expo-router";

import type { PassageQuery } from "../features/reading/bookSearch";

/**
 * Entrada única al lector (#112): capítulo, y el versículo en el que se abre la
 * hoja de acciones si viene. La usan el buscador, el plan de lectura, los
 * recorridos y el visor de historias (#115), para no armar la ruta a mano en
 * cada pantalla.
 */
export function openPassage(passage: PassageQuery) {
  router.push({
    pathname: "/leer/[book]/[chapter]",
    params: {
      book: passage.book,
      chapter: String(passage.chapter),
      ...(passage.verse === undefined ? {} : { verse: String(passage.verse) }),
    },
  });
}

/** Pantalla de un plan de lectura: el anual o un recorrido corto (#115). */
export function openReadingPlan(planId: string) {
  router.push({ pathname: "/leer/plan", params: { planId } });
}
