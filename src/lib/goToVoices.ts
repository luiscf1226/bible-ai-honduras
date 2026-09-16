import { router } from "expo-router";

/**
 * Entrada única a Voces con un personaje opcional (#145).
 * Si no hay slug, abre el catálogo para que el usuario elija.
 */
export function goToVoices(slug?: string) {
  if (slug) {
    router.push(`/voces/${slug}`);
    return;
  }
  router.push("/voces");
}
