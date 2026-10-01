import { router } from "expo-router";

/**
 * Entrada única a Voces con un personaje opcional (#145).
 * Si no hay slug, abre el catálogo para que el usuario elija.
 *
 * `draft` deja escrito un primer mensaje en el campo (desde el lector: "Estoy
 * leyendo Éxodo 14…"). Nunca se manda solo: la persona lo edita o lo borra.
 */
export function goToVoices(slug?: string, options: { draft?: string } = {}) {
  if (slug) {
    router.push({
      pathname: "/voces/[slug]",
      params: options.draft ? { slug, borrador: options.draft } : { slug },
    });
    return;
  }
  router.push("/voces");
}
